import { useRef } from 'react';

export const useFileHandler = ({
  rooms,
  walls,
  objects,
  setRooms,
  setWalls,
  setObjects,
  showSnackbar
}) => {
  const fileInputRef = useRef(null);

  const handleSave = async () => {
    try {
      const data = {
        version: 1,
        timestamp: Date.now(),
        rooms,
        walls,
        objects
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });

      // Use the File System Access API if available
      if (window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: 'floorplan.json',
            types: [{
              description: 'JSON Files',
              accept: { 'application/json': ['.json'] },
            }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          showSnackbar('Saved successfully!', 'success');
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('Save failed:', err);
            showSnackbar('Failed to save file.', 'error');
          }
        }
      } else {
        // Fallback for browsers that don't support File System Access API
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'floorplan.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showSnackbar('Saved successfully!', 'success');
      }
    } catch (error) {
      console.error('Error saving file:', error);
      showSnackbar('An error occurred while saving.', 'error');
    }
  };

  const handleLoad = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let data = JSON.parse(event.target.result);

        // Handle legacy format where data is wrapped in a 'data' property
        if (data.data && (data.data.rooms || data.data.walls || data.data.objects)) {
          data = data.data;
        }

        if (data.rooms && Array.isArray(data.rooms)) {
          setRooms(data.rooms);
        }
        if (data.walls && Array.isArray(data.walls)) {
          setWalls(data.walls);
        }
        if (data.objects && Array.isArray(data.objects)) {
          setObjects(data.objects);
        }

        showSnackbar('Loaded successfully!', 'success');
      } catch (error) {
        console.error('Error parsing file:', error);
        showSnackbar('Failed to load file. Invalid format.', 'error');
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be loaded again
    e.target.value = '';
  };

  return {
    fileInputRef,
    handleSave,
    handleLoad,
    handleFileChange
  };
};
