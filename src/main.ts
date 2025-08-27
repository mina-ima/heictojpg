import './style.css';

// DOM Elements
const dropZone = document.getElementById('drop-zone') as HTMLDivElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const fileSelectBtn = document.getElementById('file-select-btn') as HTMLButtonElement;
const fileListDiv = document.getElementById('file-list') as HTMLDivElement;
const statusArea = document.getElementById('status-area') as HTMLDivElement;
const controls = document.getElementById('controls') as HTMLDivElement;
const startBtn = document.getElementById('start-btn') as HTMLButtonElement;

let selectedFiles: File[] = [];

// --- Event Listeners ---

// Open file dialog when button is clicked
fileSelectBtn.addEventListener('click', () => {
  fileInput.click();
});

// Handle file selection from dialog
fileInput.addEventListener('change', () => {
  if (fileInput.files) {
    handleFiles(fileInput.files);
  }
});

// --- Drag and Drop Handlers ---

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer && e.dataTransfer.files) {
    handleFiles(e.dataTransfer.files);
  }
});

// --- Core Functions ---

/**
 * Handles the selected files from both dialog and D&D.
 * @param files - The list of files to handle.
 */
function handleFiles(files: FileList) {
  // For now, just log the files to the console.
  // We will add more logic here in the next steps.
  console.log('Selected files:', files);

  // Convert FileList to Array and store it
  selectedFiles = Array.from(files);

  if (selectedFiles.length > 0) {
    // TODO: Implement file list display (Task 5)
    // TODO: Implement validation (Task 8, 9)
    // TODO: Update UI state (Task 6)
    console.log(`${selectedFiles.length} file(s) selected.`);
    startBtn.disabled = false;
    dropZone.hidden = true;
    statusArea.hidden = false;
    controls.style.display = 'flex'; // Show controls
  } else {
    startBtn.disabled = true;
  }
}