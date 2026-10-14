const API = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface ImageRequest {
  model: string;
  prompt: string;
  refs: { mimeType: string; data: Buffer }[];
  aspectRatio?: string;
  imageSize?: '1K' | '2K' | '4K';
}

export async function generateImage(req: ImageRequest): Promise<Buffer> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const parts: unknown[] = [
    ...req.refs.map((r) => ({ inlineData: { mimeType: r.mimeType, data: r.data.toString('base64') } })),
    { text: req.prompt },
  ];
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: req.aspectRatio ?? '1:1', ...(req.imageSize ? { imageSize: req.imageSize } : {}) },
    },
  };
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}/${req.model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as any;
    const img = json?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
    if (res.ok && img) return Buffer.from(img, 'base64');
    const reason = json?.error?.message ?? json?.candidates?.[0]?.finishReason ?? res.status;
    if (attempt >= 3) throw new Error(`Gemini image generation failed: ${reason}`);
    await new Promise((r) => setTimeout(r, 4000 * attempt));
  }
}
