import './style.css';

// Define UI states
type UIState = 'initial' | 'files-selected' | 'converting' | 'converted' | 'error';

// --- Constants ---
const MAX_FILE_COUNT = 200;
const MAX_TOTAL_SIZE_GB = 4;
const MAX_TOTAL_SIZE_BYTES = MAX_TOTAL_SIZE_GB * 1024 * 1024 * 1024;

// DOM Elements
const dropZone = document.getElementById('drop-zone') as HTMLDivElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const fileSelectBtn = document.getElementById('file-select-btn') as HTMLButtonElement;
const fileListDiv = document.getElementById('file-list') as HTMLDivElement;
const statusArea = document.getElementById('status-area') as HTMLDivElement;
const statusMessage = document.getElementById('status-message') as HTMLParagraphElement;
const progressBar = document.getElementById('progress-bar') as HTMLDivElement;
const errorArea = document.getElementById('error-area') as HTMLDivElement;
const errorMessage = document.getElementById('error-message') as HTMLParagraphElement;
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;
const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;

// --- State Variables ---
let selectedFiles: File[] = [];
let convertedFiles: { name: string; blob: Blob }[] = [];
let worker: Worker | null = null;

// --- Worker Setup ---
function setupWorker() {
  if (worker) {
    worker.terminate();
  }
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

  worker.addEventListener('message', (event) => {
    const { type, payload } = event.data;
    switch (type) {
      case 'progress':
        const percentage = (payload.current / payload.total) * 100;
        updateProgress(percentage);
        statusMessage.textContent = `(${payload.current}/${payload.total}) ${payload.currentFile} を変換中...`;
        break;
      case 'converted-file':
        const newName = payload.originalName.replace(/\.(heic|heif)$/i, '.jpg');
        convertedFiles.push({ name: newName, blob: payload.convertedBlob });
        break;
      case 'done':
        setUIState('converted');
        break;
      case 'error':
        showError(payload.message);
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
cancelBtn.addEventListener('click', () => resetUI());

// --- Core Functions ---

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
    showError(`合計ファイルサイズの上限（${MAX_TOTAL_SIZE_GB}GB）を超えています。`);
    return;
  }

  selectedFiles = fileArray;
  if (selectedFiles.length > 0) {
    updateFileList();
    setUIState('files-selected');
  } else {
    resetUI();
  }
}

function validateFileType(files: File[]): File | null {
  for (const file of files) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const isValid = 
      file.type === 'image/heic' || 
      file.type === 'image/heif' || 
      extension === 'heic' || 
      extension === 'heif';
    if (!isValid) return file;
  }
  return null;
}

function updateFileList() {
  fileListDiv.innerHTML = '';
  selectedFiles.forEach(file => {
    const fileItem = document.createElement('div');
    fileItem.textContent = file.name;
    fileListDiv.appendChild(fileItem);
  });
}

function startConversion() {
  if (!worker) return;
  convertedFiles = []; // Clear previous results
  setUIState('converting');
  updateProgress(0);
  worker.postMessage({ type: 'start-conversion', files: selectedFiles });
}

function updateProgress(percentage: number) {
  progressBar.style.width = `${Math.min(percentage, 100)}%`;
}

function showError(message: string) {
  errorMessage.textContent = message;
  setUIState('error');
}

function resetUI() {
  selectedFiles = [];
  convertedFiles = [];
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
      statusMessage.textContent = '';
      break;
    case 'files-selected':
      statusArea.hidden = false;
      startBtn.hidden = false;
      startBtn.disabled = false;
      resetBtn.hidden = false;
      statusMessage.textContent = `合計 ${selectedFiles.length} 枚のファイルが選択されました。`;
      break;
    case 'converting':
      statusArea.hidden = false;
      startBtn.hidden = false;
      startBtn.disabled = true;
      cancelBtn.hidden = false;
      statusMessage.textContent = '変換中...'; // Initial message
      break;
    case 'converted':
      statusArea.hidden = false;
      downloadBtn.hidden = false;
      resetBtn.hidden = false;
      statusMessage.textContent = '変換が完了しました。ダウンロードしてください。';
      break;
    case 'error':
      errorArea.hidden = false;
      resetBtn.hidden = false;
      // Error message is set in showError
      break;
  }
}

// Initial Setup
resetUI();
