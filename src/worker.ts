import JSZip from 'jszip';

declare const self: Worker;

let currentAbortController: AbortController | null = null; // Worker内部でAbortControllerを管理

self.addEventListener('message', async (event) => {
  const { type, files } = event.data; // signalの受け取りを削除

  if (type === 'start-zipping') { // メッセージタイプをstart-zippingに戻す
    currentAbortController = new AbortController(); // 新しいAbortControllerを作成
    const signal = currentAbortController.signal; // そのsignalを使用

    try {
      const convertedFiles = files; // main.tsから変換済みファイルを受け取る

      // --- Zipping Converted Files ---
      self.postMessage({ type: 'debug', payload: 'Starting zipping process...' }); // DEBUG: ZIP開始ログ
      const zip = new JSZip();
      for (let i = 0; i < convertedFiles.length; i++) {
        const file = convertedFiles[i];
        if (signal.aborted) { // signal.abortedでキャンセルをチェック
          self.postMessage({ type: 'error', payload: { message: 'ZIP作成がキャンセルされました。' } });
          return;
        }
        zip.file(file.name, file.blob);

        self.postMessage({
          type: 'zip-progress',
          payload: {
            current: i + 1,
            total: convertedFiles.length,
          },
        });
      }
      self.postMessage({ type: 'debug', payload: 'Finished adding files to zip. Generating zip blob...' }); // DEBUG: ZIP生成前ログ

      const zipBlob = await zip.generateAsync({ type: 'blob', signal: signal }); // Worker内部のsignalを渡す
      self.postMessage({ type: 'done', payload: zipBlob });
      self.postMessage({ type: 'debug', payload: 'Zip blob generated and sent.' }); // DEBUG: ZIP完了ログ

    } catch (error: any) {
      if (error.name === 'AbortError') {
        self.postMessage({ type: 'debug', payload: 'Operation aborted.' }); // DEBUG: Abortログ
      } else {
        self.postMessage({ type: 'error', payload: { message: error.message || '処理中にエラーが発生しました。' } });
        self.postMessage({ type: 'debug', payload: `Error in worker: ${error.message}` }); // DEBUG: エラーログ
      }
    } finally {
      currentAbortController = null; // 処理完了後、AbortControllerをクリア
      self.postMessage({ type: 'debug', payload: 'Worker process finished or aborted.' }); // DEBUG: finallyログ
    }
  } else if (type === 'cancel') { // main.tsからのキャンセルメッセージを処理
    if (currentAbortController) {
      currentAbortController.abort(); // 処理中のAbortControllerをabortする
      self.postMessage({ type: 'debug', payload: 'Abort signal sent to current operation.' }); // DEBUG: キャンセルログ
    }
  }
});
