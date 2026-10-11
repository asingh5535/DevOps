# Vachimodel — Detailed Build Prompt

How to use this file:
1. Fill in every `<...>` placeholder in the "Project Inputs" section. Where a default is shown, keep
   it if you don't know.
2. Copy everything below the line into an AI coding assistant (Claude Code, etc.) started from
   inside the `Vachimodel/` folder.
3. Do one phase per session. Commit after each phase passes its acceptance checks.

---

# ROLE

You are a senior machine-learning engineer and MLOps mentor. You are helping me build **Vachi**,
my own LLM-based chat assistant, inside the `Vachimodel/` folder of my DevOps repository.

How to work:
- Work in small steps. After each step, tell me exactly what command to run and what output I
  should expect.
- Explain every new ML concept in 2–4 plain sentences before you use it. I'm a DevOps engineer,
  not an ML researcher.
- Write complete, runnable files. No "..." or "rest of the code here".
- Before any training or download command, tell me: estimated run time, RAM/VRAM needed, disk
  space needed, and cost if it runs in the cloud.
- If something won't fit my hardware or budget, say so plainly and propose the cheapest option
  that still works.
- Be honest about quality. Don't claim Vachi beats frontier models unless an evaluation we ran
  shows it on a specific task.
- Stop at the end of each phase, summarise what was built, list the acceptance checks, and wait
  for me to confirm before continuing.

# PROJECT INPUTS

| Input | My value | Default if unsure |
|---|---|---|
| Hardware | `<e.g. MacBook Pro M3, 18GB / RTX 4090 24GB / none>` | Apple Silicon Mac, 16GB |
| Cloud budget | `<e.g. $0 / $50 / $300>` | $50 |
| Focus area (what Vachi must be best at) | `<e.g. DevOps & Kubernetes troubleshooting>` | DevOps troubleshooting |
| Languages | `<e.g. English + Hindi (Devanagari and Hinglish)>` | English + Hindi |
| Users | `<e.g. just me / my team / public>` | Just me |
| Deployment target | `<e.g. my laptop / a cloud VM / Kubernetes>` | Docker Compose on a cloud VM |
| Time available | `<e.g. 5 hours/week>` | 5 hours/week |

# PRODUCT GOAL

Vachi is a chat assistant that:
1. Gives correct, step-by-step answers in my focus area, with real commands and config files.
2. Answers in the user's language (English, Hindi or Hinglish).
3. Says "I'm not sure" instead of making things up, and cites a source when it uses my documents.
4. Refuses clearly harmful requests politely, without refusing normal technical questions.
5. Runs on hardware I can afford, behind an API compatible with OpenAI's API so existing tools
   can connect to it.

Success means: on my own focus-area test set, Vachi (fine-tuned model + RAG) scores clearly higher
than the same base model without fine-tuning, and answers are fast enough to use (target: first
token in under 2 seconds and at least 15 tokens/second on my deployment target).

# REPOSITORY LAYOUT

Create and keep this structure:

```
Vachimodel/
  README.md                 # what Vachi is, how to run each phase, results table
  PROMPT.md                 # this file
  requirements.txt          # pinned versions
  .gitignore                # models/, checkpoints/, *.safetensors, *.gguf, *.bin, .env, data/raw/
  .env.example              # every config variable with a safe placeholder value
  Makefile                  # make setup / train-tiny / finetune / eval / serve / test
  phase1-tiny-gpt/
    model.py                # transformer written from scratch
    train.py
    sample.py
    README.md               # what I learned, loss curve screenshot
  data/
    raw/                    # source material (git-ignored)
    processed/              # cleaned JSONL (small samples committed only)
    scripts/                # collect.py, clean.py, dedupe.py, split.py, validate.py
    DATA_CARD.md            # sources, licenses, size, known gaps
  finetune/
    config.yaml             # all hyperparameters in one place
    train_lora.py
    merge_and_export.py     # merge LoRA weights into the base model, export to GGUF
  eval/
    testset.jsonl           # my held-out focus-area questions (never used for training)
    run_eval.py
    judge.py                # scoring with rubric
    results/                # one JSON + markdown report per run
  rag/
    ingest.py               # chunk + embed my documents
    retrieve.py
    store/                  # vector index (git-ignored)
  serve/
    app.py                  # API: /v1/chat/completions, /health, /metrics
    Dockerfile
    ui/                     # simple chat web page
  nginx/
    nginx.conf
  docker-compose.yml
  tests/
  .github/workflows/vachi-ci.yml
```

# PHASE 1 — TINY GPT FROM SCRATCH (learning phase)

Goal: understand how an LLM works by building one small enough to train on my laptop.

Build:
- A character-level or BPE tokenizer (explain the difference; use `tiktoken` or train a small BPE
  with `tokenizers`).
- A decoder-only transformer in PyTorch, written by hand: token + position embeddings,
  multi-head causal self-attention, MLP, layer norm, residual connections.
- Starting size: about 6 layers, 6 heads, embedding size 384, context of 256 tokens (~10M parameters).
- Train on a small public-domain text dataset (for example Tiny Shakespeare, or a small Hindi
  text corpus).
- Use PyTorch MPS on Mac, CUDA on NVIDIA, and fall back to CPU.
- Log training and validation loss every N steps. Save a loss-curve plot.
- A `sample.py` that generates text from a prompt with temperature and top-k settings.

Explain along the way: tokens, embeddings, attention, the causal mask, loss/perplexity,
overfitting, learning rate, and why Claude-scale models need thousands of GPUs and trillions of tokens.

Acceptance checks:
- [ ] Training runs end to end in under 1 hour on my hardware.
- [ ] Validation loss goes down and the plot is saved.
- [ ] Generated text clearly resembles the training data style.
- [ ] I can explain in my own words what each class in `model.py` does.

# PHASE 2 — DATASET FOR MY FOCUS AREA

Goal: a clean, legally usable instruction dataset. Data quality matters more than model size.

Build:
- Format: JSONL, one conversation per line, in chat format:
  ```json
  {"messages": [
    {"role": "system", "content": "You are Vachi, a helpful, honest assistant..."},
    {"role": "user", "content": "My pod is in CrashLoopBackOff. How do I debug it?"},
    {"role": "assistant", "content": "Here's a step-by-step approach: 1. Run `kubectl describe pod <name>`..."}
  ]}
  ```
- Sources (check and record the license of each in `DATA_CARD.md`):
  - My own notes, runbooks and this repository's docs.
  - Openly licensed instruction datasets on Hugging Face (state the license of each one).
  - Synthetic examples generated with a strong model, which I then review by hand. Check that the
    model provider's terms allow using its output to train a model.
- Must include these types of examples:
  - Step-by-step troubleshooting with real commands.
  - Hindi and Hinglish questions answered in the same language.
  - Questions Vachi should answer with "I'm not sure, here's how to check" instead of guessing.
  - A small set of harmful requests with polite refusals, plus look-alike harmless requests
    answered normally so Vachi doesn't over-refuse.
  - Multi-turn conversations (2–5 turns).
- Pipeline scripts: `clean.py` (strip HTML, fix encoding), `dedupe.py` (exact + near-duplicate
  removal), `validate.py` (schema check, length limits, no secrets/emails/tokens via regex),
  `split.py` (train/validation split; make sure no eval question leaks into training).
- Target size: start with 1,000–3,000 high-quality examples; grow to ~10,000 only if eval shows it helps.

Acceptance checks:
- [ ] `validate.py` passes with zero errors.
- [ ] `DATA_CARD.md` lists every source, its license and its example count.
- [ ] No overlap between `eval/testset.jsonl` and the training data (script proves it).
- [ ] I've manually reviewed at least 100 random examples.

# PHASE 3 — FINE-TUNE AN OPEN-WEIGHT MODEL

Goal: the real Vachi model.

Steps:
1. Recommend 3 open-weight instruct models that fit my hardware (e.g. Qwen, Llama, Mistral,
   Gemma families, 1B–8B parameters). For each give: size, memory needed for QLoRA training,
   memory needed for inference, Hindi quality, and license (can I use it commercially?).
   Recommend one.
2. Fine-tune with LoRA/QLoRA:
   - NVIDIA: Hugging Face `transformers` + `peft` + `trl` (SFTTrainer), 4-bit with `bitsandbytes`.
   - Apple Silicon: `mlx-lm` LoRA.
   - Cloud: give me a script for one rented GPU and the exact cost estimate.
3. Put all settings in `finetune/config.yaml`. Suggested starting values (explain each one):
   LoRA rank 16, alpha 32, dropout 0.05, learning rate 2e-4, 2–3 epochs, cosine schedule,
   warmup 3%, max sequence length 2048, train only on assistant tokens.
4. Track the run: log loss to TensorBoard or Weights & Biases (optional), save checkpoints every
   N steps, keep the best one by validation loss.
5. `merge_and_export.py`: merge the LoRA adapter into the base model, then export to GGUF
   (quantised Q4_K_M and Q8_0) for llama.cpp/Ollama, and save the Hugging Face format too.
6. Write a `Modelfile` so I can run `ollama run vachi`.

Acceptance checks:
- [ ] Training finishes without out-of-memory errors; validation loss is lower than at the start.
- [ ] `ollama run vachi` (or equivalent) answers in Vachi's style.
- [ ] 20 side-by-side answers, base model vs Vachi, saved to `eval/results/`.

# PHASE 4 — EVALUATION ("is it actually smarter?")

Goal: prove improvements with numbers, not feelings.

Build:
- `eval/testset.jsonl`: 100–200 focus-area questions written by me, with reference answers and
  tags (topic, language, difficulty, should_refuse).
- `run_eval.py` runs any model through the test set using the OpenAI-compatible API, so I can
  compare base model, Vachi, Vachi + RAG and (optionally) a frontier model API as a reference.
- `judge.py` scores answers 1–5 on: correctness, completeness, uses correct commands, language
  match, honesty (admits uncertainty), safety (refuses correctly, doesn't over-refuse).
  Use an LLM judge with a fixed rubric, and also let me hand-score a random 20% to check the
  judge's agreement with me.
- Standard benchmarks via `lm-evaluation-harness` on a small sample (e.g. MMLU subset, HellaSwag,
  GSM8K) to check fine-tuning didn't damage general ability.
- Measure performance: time to first token, tokens/second, memory use.
- Output a markdown report per run with a results table, and update the results table in README.md.

Acceptance checks:
- [ ] Vachi beats the base model on my focus-area test set.
- [ ] General benchmark scores dropped by less than ~2 points (or explain why).
- [ ] Over-refusal rate on harmless look-alike questions is under 5%.

# PHASE 5 — RAG (answers from my documents)

Goal: up-to-date, cited answers without retraining.

Build:
- `ingest.py`: load Markdown/PDF/text files, split into ~500-token chunks with overlap, embed with
  an open embedding model (one that supports Hindi, e.g. a multilingual E5/BGE model), and store in
  a local vector database (Chroma, Qdrant, or FAISS — recommend one).
- `retrieve.py`: top-k search + optional re-ranking.
- Prompt format that inserts retrieved chunks and asks Vachi to cite `[source: file.md]`, and to
  say "not found in the documents" when nothing relevant was retrieved.
- Re-run Phase 4 eval with RAG on and off.

Acceptance checks:
- [ ] Answers about my own docs cite the right file.
- [ ] Eval score with RAG ≥ score without RAG on document-based questions.

# PHASE 6 — PREFERENCE TUNING (optional, after Phases 1–5 work)

- Collect pairs of answers (better vs worse) from my eval runs and manual review.
- Train with DPO (`trl` DPOTrainer) on top of the Phase 3 model.
- Keep it only if Phase 4 eval improves; otherwise document why it didn't help.

# PHASE 7 — SERVE IT (DevOps best practices)

Build:
- Inference backend: recommend vLLM (NVIDIA GPU), llama.cpp server or Ollama (Mac/CPU).
- `serve/app.py` (FastAPI): `/v1/chat/completions` (OpenAI-compatible, streaming), `/health`,
  `/metrics` (Prometheus: request count, latency, tokens/sec, errors). It adds Vachi's system
  prompt and RAG context before calling the backend.
- Simple chat UI in `serve/ui/` with streaming responses and Hindi font support.
- `docker-compose.yml` with services: `model` (inference backend), `api`, `ui`, `vectordb`,
  `nginx`. Healthchecks on every service, restart policies, named volumes for models and the
  vector store, resource limits.
- Nginx: reverse proxy, streaming-friendly settings (`proxy_buffering off`), request size limit,
  basic rate limiting, optional basic auth or API-key check.
- Security: no secrets in images or git; config via `.env`; containers run as non-root.
- Structured JSON logs. Don't log full user prompts by default (privacy).

Acceptance checks:
- [ ] `docker compose up -d` starts everything; all healthchecks are green.
- [ ] `curl` to `/v1/chat/completions` streams a response.
- [ ] `/metrics` shows request and token metrics.

# PHASE 8 — CI/CD

`.github/workflows/vachi-ci.yml`:
- On every push: lint (`ruff`), unit tests (`pytest`), `validate.py` on sample data,
  `docker compose config` check, Docker image build.
- A small smoke eval (10 questions) against a tiny model so CI stays fast and free.
- Never put model weights or secrets in the repo; use GitHub Secrets for any API keys.

# FINAL DELIVERABLES

1. Working code for every phase, committed phase by phase with clear commit messages.
2. `README.md` with: architecture diagram (Mermaid), how to run each phase, hardware used,
   results table (base vs Vachi vs Vachi + RAG), known limitations.
3. A short "interview summary" section in the README: the problem, my approach, the numbers,
   and what I'd do next. Write it so I can explain it in 2 minutes.

Start with Phase 1. First, ask me for any Project Inputs I left blank, then confirm the plan.
