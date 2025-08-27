import './style.css';

// Define UI states
type UIState = 'initial' | 'files-selected' | 'converting' | 'converted' | 'error';

// DOM Elements
const dropZone = document.getElementById('drop-zone') as HTMLDivElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const fileSelectBtn = document.getElementById('file-select-btn') as HTMLButtonElement;
const fileListDiv = document.getElementById('file-list') as HTMLDivElement;
const statusArea = document.getElementById('status-area') as HTMLDivElement;
const statusMessage = document.getElementById('status-message') as HTMLParagraphElement;
const progressBar = document.getElementById('progress-bar') as HTMLDivElement;
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;
const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement;
const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;
const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;

let selectedFiles: File[] = [];
let conversionInterval: number | null = null;

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

startBtn.addEventListener('click', () => {
  startConversion();
});

resetBtn.addEventListener('click', () => resetUI());

cancelBtn.addEventListener('click', () => {
  if (conversionInterval) clearInterval(conversionInterval);
  resetUI();
  console.log('Conversion cancelled.');
});

// --- Core Functions ---

function handleFiles(files: FileList) {
  selectedFiles = Array.from(files);
  if (selectedFiles.length > 0) {
    updateFileList();
    setUIState('files-selected');
  } else {
    resetUI();
  }
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
  setUIState('converting');
  let progress = 0;
  updateProgress(0);

  // Simulate conversion progress
  conversionInterval = setInterval(() => {
    progress += 10;
    updateProgress(progress);
    if (progress >= 100) {
      if (conversionInterval) clearInterval(conversionInterval);
      setUIState('converted');
    }
  }, 200);
}

function updateProgress(percentage: number) {
  const p = Math.min(percentage, 100);
  progressBar.style.width = `${p}%`;
  statusMessage.textContent = `変換中... (${p}%)`;
}

function resetUI() {
  if (conversionInterval) clearInterval(conversionInterval);
  selectedFiles = [];
  fileInput.value = '';
  fileListDiv.innerHTML = '';
  updateProgress(0);
  setUIState('initial');
}

function setUIState(state: UIState) {
  dropZone.hidden = true;
  statusArea.hidden = true;
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
      break;

    case 'converted':
      statusArea.hidden = false;
      downloadBtn.hidden = false;
      resetBtn.hidden = false;
      statusMessage.textContent = '変換が完了しました。ダウンロードしてください。';
      break;

    case 'error':
      statusArea.hidden = false;
      resetBtn.hidden = false;
      break;
  }
}

// Initialize UI
resetUI();
