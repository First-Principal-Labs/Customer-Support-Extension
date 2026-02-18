/**
 * Lightweight in-browser RAG (Retrieval-Augmented Generation).
 *
 * When rule.memory exceeds RAG_MEMORY_THRESHOLD characters, the full text is
 * split into chunks and only the top-K most relevant chunks (scored via BM25)
 * are injected into the system prompt instead of the whole memory.
 */

/** Inject full memory below this size; use RAG above it (~750 tokens). */
export const RAG_MEMORY_THRESHOLD = 3000;

const RAG_CHUNK_TARGET = 600; // target chars per chunk
const RAG_TOP_K = 4;          // chunks to retrieve

// Common English stopwords to ignore during tokenisation
const STOPWORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'is','it','its','i','you','we','they','this','that','be','are','was',
  'were','has','have','had','do','does','did','will','would','could',
  'should','not','no','can','so','if','as','by','from','up','about',
  'into','than','then','when','where','who','which','what','how','also',
  'just','more','been','their','there','our','your','my','his','her',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Split memory into overlapping-free chunks.
 * Preference: paragraph boundaries → sentence boundaries → hard split.
 */
export function chunkMemory(memory: string): string[] {
  const paragraphs = memory.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if (current.length + para.length + 2 <= RAG_CHUNK_TARGET) {
      current = current ? `${current}\n\n${para}` : para;
    } else {
      if (current) chunks.push(current);

      if (para.length > RAG_CHUNK_TARGET) {
        // Split large paragraph by sentence
        const sentences = para.match(/[^.!?\n]+[.!?]*/g) ?? [para];
        let sentChunk = '';
        for (const sent of sentences) {
          if (sentChunk.length + sent.length <= RAG_CHUNK_TARGET) {
            sentChunk += sent;
          } else {
            if (sentChunk) chunks.push(sentChunk.trim());
            sentChunk = sent;
          }
        }
        current = sentChunk.trim();
      } else {
        current = para;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.filter(Boolean);
}

/**
 * BM25 relevance score between a query and one chunk.
 * k1=1.5, b=0.75 — standard defaults.
 */
function bm25Score(
  queryTerms: string[],
  chunkTerms: string[],
  avgChunkLen: number
): number {
  const k1 = 1.5;
  const b = 0.75;
  const dl = chunkTerms.length;

  // Build term-frequency map for this chunk
  const tf: Record<string, number> = {};
  for (const t of chunkTerms) tf[t] = (tf[t] ?? 0) + 1;

  let score = 0;
  // Deduplicate query terms so each unique term is scored once
  for (const term of new Set(queryTerms)) {
    const f = tf[term] ?? 0;
    if (f === 0) continue;
    const normalised = (f * (k1 + 1)) / (f + k1 * (1 - b + b * (dl / avgChunkLen)));
    // Without a document corpus we can't compute true IDF; treat all terms equally.
    score += normalised;
  }
  return score;
}

/**
 * Given the full memory string and the current customer query, return the most
 * relevant portion of the memory to include in the system prompt.
 *
 * - If memory is short enough, returns it unchanged.
 * - Otherwise chunks the memory and scores each chunk against the query with
 *   BM25, returning the top-K chunks joined by double newline.
 */
export function retrieveRelevantContext(memory: string, query: string): string {
  if (memory.length <= RAG_MEMORY_THRESHOLD) return memory;

  const chunks = chunkMemory(memory);
  if (chunks.length === 0) return memory;

  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) {
    // No useful tokens — return first K chunks as a safe fallback
    return chunks.slice(0, RAG_TOP_K).join('\n\n');
  }

  const tokenizedChunks = chunks.map(tokenize);
  const avgLen =
    tokenizedChunks.reduce((s, t) => s + t.length, 0) / tokenizedChunks.length;

  const scored = chunks.map((chunk, i) => ({
    chunk,
    score: bm25Score(queryTerms, tokenizedChunks[i], avgLen),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored
    .slice(0, RAG_TOP_K)
    .map((s) => s.chunk)
    .join('\n\n');
}
