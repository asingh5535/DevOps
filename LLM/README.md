# LLM

Local AI / generative model experiments, run on Docker Desktop Kubernetes.

| Folder | Model | What it does |
|--------|-------|--------------|
| `deepfake/` | [FaceFusion 3.9.1](https://github.com/facefusion/facefusion) | Face swap / face enhancement on images and video, Gradio web UI |

## deepfake/ — FaceFusion on Kubernetes

```
deepfake/
├── Dockerfile          python:3.12-slim + ffmpeg + FaceFusion (CPU onnxruntime)
├── k8s/deepfake.yaml   Namespace llm, 2 PVCs, Deployment, ClusterIP Service
└── deploy.sh           build -> load into kind nodes -> apply -> wait
```

### Prerequisites
- Docker Desktop with Kubernetes enabled (context `docker-desktop`)
- Give Docker Desktop at least 8 GB RAM and 4 CPUs (Settings → Resources)

### Deploy
From Git Bash (not CMD — the image-load pipe fails there):

```bash
cd LLM/deepfake
./deploy.sh
```

The first start downloads ~1–2 GB of ONNX models into the `facefusion-models` PVC, so the pod
takes a while to become Ready. Restarts reuse the downloaded models.

Watch progress:
```bash
kubectl -n llm get pods -w
kubectl -n llm logs -f deploy/facefusion
```

### Use
```bash
kubectl -n llm port-forward svc/facefusion 7860:7860
```
Open http://localhost:7860, pick a **source** face image and a **target** image/video, choose the
processors (face_swapper, face_enhancer, …) and click **Start**. Outputs are written to `/data/output`
in the pod; copy them out with:
```bash
kubectl -n llm cp $(kubectl -n llm get pod -l app=facefusion -o name | cut -d/ -f2):/data/output ./output
```

### Notes
- Runs on CPU (onnxruntime). Images take seconds; video is slow — keep clips short for testing.
- FaceFusion's built-in NSFW content check stays enabled.
- Only use faces of people who have given consent. Creating non-consensual intimate imagery, or using
  swapped media to impersonate or defraud someone, is illegal in many jurisdictions.

### Tear down
```bash
kubectl delete namespace llm
```
