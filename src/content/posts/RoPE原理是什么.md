---
title: "RoPE原理"
description: "从二维旋转理解 RoPE 的相对位置编码，梳理 Q/K 应用、cos/sin 计算、KV Cache 与长上下文外推问题。"
pubDate: 2026-10-26
tags: ["QKV", "技术", "大模型"]
---

## RoPE 的原理是什么？

RoPE（Rotary Position Embedding）不是把一个额外的位置向量加到 Q/K 上，而是根据 Token 的位置，对 Q 和 K 的各个二维子空间做旋转。

对位置 `p` 的某一对维度，设：

```text
x = [x₀, x₁]
```

旋转角度为 `θ_p`，则：

```text
x'₀ = x₀ cos(θ_p) - x₁ sin(θ_p)
x'₁ = x₀ sin(θ_p) + x₁ cos(θ_p)
```

矩阵形式为：

```text
[x'₀]   [ cos θ  -sin θ ] [x₀]
[x'₁] = [ sin θ   cos θ ] [x₁]
```

不同维度对子使用不同频率，常见形式是：

```text
θ_{p,i} = p / base^{2i/d}
```

其中：

- `p` 是 Token 位置；
- `i` 是维度对子索引；
- `d` 是 head dimension；
- `base` 通常是 `10000`，当前项目由 `rope_theta` 配置。

RoPE 的关键性质是：Q 和 K 都使用与位置相关的旋转后，它们的点积会体现相对位置信息：

```text
(R_p q)ᵀ (R_t k)
```

其结果与 `p - t` 有关，因此 Attention 不仅能看到内容相似度，还能感知两个 Token 的相对距离。

---

## 为什么按二维对子旋转？

二维旋转是 RoPE 的基本数学形式，原因主要有三点。

### 1. 旋转可以自然编码位置信息

二维平面中的旋转由一对：

```text
cos θ、sin θ
```

决定。随着位置变化，向量在二维平面中按不同角速度旋转，位置就被编码到了向量的相位中。

### 2. 保持向量的长度

旋转矩阵是正交矩阵，因此：

```text
||Rθ x|| = ||x||
```

它只改变方向和相位，不改变向量范数，通常不会像直接加位置向量那样改变表示的整体幅度。

### 3. 不同维度可以使用不同频率

将 head dimension 分成多个二维子空间：

```text
(d₀, d₁)
(d₂, d₃)
...
```

低维对子使用较高频率，高维对子使用较低频率。这样可以同时表示短距离和较长距离的位置信息。

当前项目支持两种旋转布局：

- `Normal`：对相邻维度 `(2i, 2i+1)` 旋转；
- `NeoX`：对前半部分和后半部分的对应维度 `(i, i + dim/2)` 旋转。

Qwen/LLaMA 类模型通常使用 NeoX 风格。当前项目在加载模型配置时设置：

```cpp
config.rope_type = RoPEType::NeoX;
```

CPU 侧的 `ApplyNeoXRoPE()` 和 CUDA 侧的 `RoPELlamaKernel` 都按照前后半维度配对。

---

## cos/sin 如何计算和缓存？

### 当前项目的计算方式

在 CPU 实现中，每次对一个 Token 的 Q/K 应用 RoPE 时，会根据当前位置和维度计算：

```cpp
float freq = 1.0f / std::pow(theta, (2.0f * i) / dim);
float angle = pos * freq;
float cos_val = std::cos(angle);
float sin_val = std::sin(angle);
```

然后完成二维旋转。

CUDA 实现中也会在 Kernel 内计算对应的：

```cpp
powf
cosf
sinf
```

例如 `RoPELlamaKernel` 会按照位置和维度计算旋转角度，再更新 Q/K。

因此需要明确：

> 当前项目没有实现独立的 RoPE cos/sin 查找表缓存，而是每次前向时根据 position 和 dimension 直接计算。

### 更高效的缓存方式

实际工程中通常会预先构造一个 RoPE 表：

```text
cos_table[position][dimension_pair]
sin_table[position][dimension_pair]
```

或者只缓存每个位置、每个频率对应的：

```text
cos(θ_{p,i})
sin(θ_{p,i})
```

推理时直接查表：

```text
cos_val = cos_table[pos][i]
sin_val = sin_table[pos][i]
```

这样可以避免每个 Token 重复执行三角函数，尤其适合 Decode 阶段。

缓存大小大致为：

```text
max_seq_len × (head_dim / 2) × 2 × sizeof(float)
```

如果 Q/K 的所有层共享相同的 RoPE 配置，这张表通常可以跨层复用，而不需要每层保存一份。

需要注意，若使用不同的 RoPE scaling、不同层配置或动态位置策略，缓存表也要与对应配置匹配。

---

## RoPE 作用在 Q、K 还是 V？

RoPE 作用在：

```text
Q 和 K
```

不作用在：

```text
V
```

当前项目中：

```cpp
InsertRoPE(q_reshape, k_reshape, pos,
           config.rope_theta,
           config.rope_type);
```

只传入 Q 和 K。

原因是 Attention 分数由 Q 和 K 的点积决定：

```text
score = QKᵀ / sqrt(head_dim)
```

对 Q、K 做旋转，可以让分数包含相对位置信息。

V 是被 Attention 权重加权聚合的内容：

```text
output = softmax(score) V
```

它主要携带内容信息，通常不需要进行 RoPE 旋转。对 V 旋转会改变被聚合的内容表示，也不符合 LLaMA/Qwen 的标准结构。

在当前项目中，流程是：

```text
Q/K 投影
  ↓
Q/K 应用 RoPE
  ↓
Q/K 写入或读取 KV Cache
  ↓
Attention
```

K 必须保存旋转之后的结果，否则后续 Decode 时，当前 Q 与历史 K 不在同一个位置编码空间中。

---

## 长上下文外推时 RoPE 有哪些问题？

RoPE 在训练上下文长度之外直接外推时，主要有以下问题。

### 1. 旋转相位快速累积

位置越大，某些频率对应的角度越大：

```text
θ = p × freq
```

当推理位置远大于训练最大长度时，角度会不断累积，导致相位变化过快。

### 2. 位置分布超出训练范围

模型训练时只见过一定范围内的位置，例如：

```text
训练上下文：4K 或 8K
推理上下文：32K
```

直接把位置扩大到 32K，会让 Q/K 的旋转分布超出训练分布，模型可能无法稳定理解远距离关系。

### 3. 高频维度出现混叠

不同频率的正弦余弦是周期函数。位置很大时，不同位置可能出现相似甚至接近的相位，导致位置信息区分度下降，这可以看作一种相位混叠或周期性退化。

### 4. 近距离分辨率与远距离范围存在冲突

RoPE 的不同频率同时承担短距离和长距离建模：

- 高频维度擅长区分近邻位置；
- 低频维度擅长表达长距离位置。

如果简单缩放所有位置，可能扩大了上下文范围，却损失了短距离位置分辨率。

### 5. Attention 数值分布变化

长上下文下，旋转后的 Q/K 分布可能与训练阶段不同，进而影响：

```text
QKᵀ
softmax
注意力集中程度
```

严重时可能出现注意力过度分散、过度集中或远距离信息利用变差。

### 常见解决方案

长上下文模型通常不会简单地直接把 `pos` 增大，而会使用 RoPE scaling，例如：

- Position Interpolation；
- NTK-aware scaling；
- YaRN；
- LongRoPE；
- 模型训练阶段专门扩展上下文长度。

这些方法的目标是在扩大可用上下文范围的同时，尽量保留原有的短距离位置分辨率和训练分布。

当前项目读取了：

```text
qwen2.rope.freq_base
```

作为 `rope_theta`，但当前前向实现主要是标准 RoPE 旋转，没有额外实现 YaRN、NTK scaling 等长上下文扩展策略。因此，实际支持的最大上下文长度还需要结合模型训练配置和当前 RoPE 实现进行验证，不能只因为 GGUF 的 `context_length` 较大，就认为可以无损外推到任意长度。

## 面试总结回答

> RoPE 通过对 Q 和 K 的二维维度对子进行与位置相关的旋转，将位置信息编码到向量相位中，使 QK 点积自然包含相对位置信息。每个维度对子使用不同频率，当前项目支持 Normal 和 NeoX 两种布局，Qwen/LLaMA 类模型通常使用 NeoX，即对第 `i` 维和第 `i + head_dim/2` 维旋转。RoPE 只作用于 Q 和 K，不作用于 V；K 需要保存旋转后的结果进入 KV Cache。当前项目在 CPU/CUDA 中每次根据 `pos`、`rope_theta` 和维度直接计算 sin/cos，还没有独立的 RoPE 查找表缓存。长上下文直接外推会遇到相位累积、周期混叠、训练分布外推和短距离分辨率下降等问题，实际模型通常需要 Position Interpolation、NTK scaling 或 YaRN 等扩展策略。
