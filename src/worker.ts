/**
 * Web Worker for handling HEIC to JPG conversion.
 */

// A simple async sleep function for simulation
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
  const { type, files } = event.data;

  if (type === 'start-conversion') {
    if (!files || files.length === 0) {
      self.postMessage({ type: 'done' });
      return;
    }

    // Process files one by one (sequentially)
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // 1. Report progress to the main thread
      self.postMessage({
        type: 'progress',
        payload: {
          currentFile: file.name,
          current: i + 1,
          total: files.length,
        },
      });

      // 2. Simulate the conversion work
      // TODO: Replace this with the actual heic2any conversion (Task 13)
      await sleep(100); // Simulate 100ms of work per file

      // 3. Report the (simulated) converted file back
      self.postMessage({
        type: 'converted-file',
        payload: {
          originalName: file.name,
          // This will be the actual converted Blob later
          convertedBlob: new Blob(['dummy'], { type: 'image/jpeg' }),
        },
      });
    }

    // 4. Signal that all files are done
    self.postMessage({ type: 'done' });
  }
});