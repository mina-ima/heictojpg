// src/worker.ts
// 役割: 変換済みファイルを ZIP にまとめる
// 中断は 'cancel' メッセージで受け取り、Promise.race で実装（JSZip に signal オプションは無い）

import JSZip from 'jszip';

type ConvertedFile = { name: string; blob: Blob };

type StartZippingMsg = { type: 'start-zipping'; files: ConvertedFile[] };
type CancelMsg = { type: 'cancel' };
type InMsg = StartZippingMsg | CancelMsg;

// cancel 用の reject を保持（未処理なら null）
let rejectAbort: ((reason?: any) => void) | null = null;

function makeAbortPromise() {
  // cancel を受けたらこの Promise を reject してレースに勝たせる
  return new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });
}

// Worker 本体
self.addEventListener('message', async (event: MessageEvent<InMsg>) => {
  const data = event.data; // ← ここでは分割代入しない（判別後にアクセス）

  try {
    switch (data.type) {
      case 'start-zipping': {
        const { files } = data; // 判別後なので OK

        if (!files || !Array.isArray(files)) {
          self.postMessage({ type: 'error', payload: { message: 'ZIP 対象が不正です。' } });
          return;
        }

        const zip = new JSZip();

        // ファイルを ZIP に追加（追加しながら簡易進捗を通知）
        files.forEach((f, idx) => {
          zip.file(f.name, f.blob);
          self.postMessage({
            type: 'zip-progress',
            payload: { current: idx + 1, total: files.length },
          });
        });

        // 生成開始
        const genPromise = zip.generateAsync({ type: 'blob' });

        // 中断監視（cancel で reject）
        const abortPromise = makeAbortPromise();

        // どちらか早い方を採用
        const zipBlob = (await Promise.race([genPromise, abortPromise])) as Blob;

        self.postMessage({ type: 'done', payload: zipBlob });
        break;
      }

      case 'cancel': {
        // race 中の処理を AbortError で即中断
        if (rejectAbort) {
          rejectAbort(new DOMException('Aborted', 'AbortError'));
          rejectAbort = null;
        }
        break;
      }
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      self.postMessage({ type: 'error', payload: { message: '処理がキャンセルされました。' } });
    } else {
      self.postMessage({
        type: 'error',
        payload: { message: err?.message ?? 'ZIP 作成中にエラーが発生しました。' },
      });
    }
  } finally {
    // 次回のために必ずクリア
    rejectAbort = null;
  }
});