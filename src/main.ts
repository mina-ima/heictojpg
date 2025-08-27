import './style.css';
import heic2any from 'heic2any';

// Define UI states
type UIState = 'initial' | 'files-selected' | 'converting' | 'converted' | 'error';

// --- Constants ---
const MAX_FILE_COUNT = 200;
const MAX_TOTAL_SIZE_GB = 4;
const MAX_TOTAL_SIZE_BYTES = MAX_TOTAL_SIZE_GB * 1024 * 1024 * 1024;
const WARN_TOTAL_SIZE_GB = 3;
const WARN_TOTAL_SIZE_BYTES = WARN_TOTAL_SIZE_GB * 1024 * 1024 * 1024;

// DOM Elements
const dropZone = document.getElementById('drop-zone') as HTMLDivElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const fileSelectBtn = document.getElementById('file-select-btn') as HTMLButtonElement;
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;
const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
const statusArea = document.getElementById('status-area') as HTMLDivElement;
const statusMessage = document.getElementById('status-message') as HTMLParagraphElement;
const errorArea = document.getElementById('error-area') as HTMLDivElement;
const errorMessage = document.getElementById('error-message') as HTMLParagraphElement;
const progressBar = document.getElementById('progress-bar') as HTMLDivElement;
const fileListDiv = document.getElementById('file-list') as HTMLDivElement;

let selectedFiles: File[] = [];
let convertedFiles: { name: string; blob: Blob }[] = [];
let worker: Worker | null = null;
let abortController: AbortController | null = null;

// --- Worker Setup ---
function setupWorker() {
  if (worker) {
    worker.terminate();
  }
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }); // Web Worker (module)

  worker.addEventListener('message', (event) => {
    const { type, payload } = event.data;
    // DEBUG: 受信メッセージログ
    console.log('Received message from worker:', type, payload);

    switch (type) {
      case 'zip-progress': // 進捗
        const zipPercentage = (payload.current / payload.total) * 100;
        updateProgress(zipPercentage);
        statusMessage.textContent = `ZIPファイルを作成中... (${payload.current}/${payload.total})`;
        break;
      case 'done':
        downloadZip(payload); // payload は zip Blob
        setUIState('converted');
        break;
      case 'error':
        showError(payload.message);
        resetUI();
        break;
      case 'debug':
        console.log('Worker Debug:', payload);
        break;
    }
  });
}

// --- Event Listeners ---
fileSelectBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  if (fileInput.files) handleFiles(fileInput.files);
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files);
});

startBtn.addEventListener('click', () => startConversion());
resetBtn.addEventListener('click', () => resetUI());
cancelBtn.addEventListener('click', () => {
  if (worker) {
    worker.postMessage({ type: 'cancel' }); // Workerにキャンセルを指示
  }
  resetUI();
});

// --- Core Functions ---
async function startConversion() {
  if (!worker || selectedFiles.length === 0) return;

  abortController = new AbortController(); // Create a new AbortController
  const { signal } = abortController;

  convertedFiles = []; // Clear previous results
  setUIState('converting');
  updateProgress(0);

  const totalFiles = selectedFiles.length;
  let processedCount = 0;

  try {
    for (const file of selectedFiles) {
      if (signal.aborted) { // Check for cancellation
        statusMessage.textContent = '変換がキャンセルされました。';
        resetUI();
        return;
      }

      statusMessage.textContent = `${file.name} を変換中...`;
      const arrayBuffer = await file.arrayBuffer();

      // 中断が要求されていれば即終了
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      const convertedBlob = await heic2any({
        blob: new Blob([arrayBuffer], { type: file.type }),
        toType: 'image/jpeg',
        quality: 0.95,
      }) as Blob;

      // 変換直後にも中断確認（保険）
      if (signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
      convertedFiles.push({ name: newName, blob: convertedBlob });

      processedCount++;
      updateProgress((processedCount / totalFiles) * 100);
    }

    if (signal.aborted) { // Check for cancellation after loop
      statusMessage.textContent = '変換がキャンセルされました。';
      resetUI();
      return;
    }

    // ZIP化をWorkerに依頼
    worker.postMessage({ type: 'start-zipping', files: convertedFiles });
    statusMessage.textContent = 'ZIPファイルを作成中...';
  } catch (error: any) {
    if (error.name === 'AbortError') {
      statusMessage.textContent = '変換がキャンセルされました。';
    } else {
      showError(error.message || '変換中にエラーが発生しました。');
    }
    // resetUI(); // 必要ならここでUIリセット
  }
}

function downloadZip(zipBlob: Blob) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  const filename = `converted_${year}-${month}-${day}_${hours}-${minutes}.zip`;

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function handleFiles(files: FileList) {
  const fileArray = Array.from(files);

  const invalidFile = validateFileType(fileArray);
  if (invalidFile) {
    showError(`HEIC/HEIF以外のファイルは含められません: ${invalidFile.name}`);
    return;
  }

  if (fileArray.length > MAX_FILE_COUNT) {
    showError(`一度に変換できるファイルは${MAX_FILE_COUNT}枚までです。`);
    return;
  }

  const totalSize = fileArray.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MAX_TOTAL_SIZE_BYTES) {
    showError(`合計サイズは最大${MAX_TOTAL_SIZE_GB}GBまでです。`);
    return;
  } else if (totalSize > WARN_TOTAL_SIZE_BYTES) {
    showWarning(`合計サイズが${WARN_TOTAL_SIZE_GB}GBを超えています。処理に時間がかかる可能性があります。`);
  }

  selectedFiles = fileArray;
  renderFileList(selectedFiles);
  setUIState('files-selected');
}

function renderFileList(files: File[]) {
  fileListDiv.innerHTML = files.map(f => `<div>${f.name} (${(f.size / (1024 * 1024)).toFixed(2)} MB)</div>`).join('');
}

function validateFileType(files: File[]): File | null {
  for (const file of files) {
    if (!/\.heic$|\.heif$/i.test(file.name)) {
      return file;
    }
  }
  return null;
}

function updateProgress(percent: number) {
  progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
}

function showWarning(message: string) {
  statusMessage.textContent = message;
  statusArea.hidden = false;
}

function showError(message: string) {
  errorMessage.textContent = message;
  errorArea.hidden = false;
}

function resetUI() {
  selectedFiles = [];
  convertedFiles = [];
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
  if (worker) {
    // Workerはキャンセル時に再生成する（進行中処理の後始末を分離）
    worker.terminate();
    worker = null;
  }
  fileInput.value = '';
  fileListDiv.innerHTML = '';
  updateProgress(0);
  setupWorker();
  setUIState('initial');
}

function setUIState(state: UIState) {
  dropZone.hidden = true;
  statusArea.hidden = true;
  errorArea.hidden = true;
  startBtn.hidden = true;
  cancelBtn.hidden = true;
  downloadBtn.hidden = true;
  resetBtn.hidden = true;

  switch (state) {
    case 'initial':
      dropZone.hidden = false;
      fileSelectBtn.hidden = false;
      statusMessage.textContent = 'ファイルをドロップするか、選択してください。';
      break;
    case 'files-selected':
      startBtn.hidden = false;
      resetBtn.hidden = false;
      statusArea.hidden = false;
      statusMessage.textContent = '準備ができました。「変換を開始」を押してください。';
      break;
    case 'converting':
      cancelBtn.hidden = false;
      statusArea.hidden = false;
      statusMessage.textContent = '変換中...';
      break;
    case 'converted':
      downloadBtn.hidden = false;
      resetBtn.hidden = false;
      statusArea.hidden = false;
      statusMessage.textContent = '変換が完了しました。ダウンロードしてください。';
      break;
    case 'error':
      errorArea.hidden = false;
      // Error message is set in showError
      break;
  }
}

// Initial Setup
resetUI();