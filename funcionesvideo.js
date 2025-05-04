import { ProcessingQueue } from './processingQueue.js';
import { setupTransitions } from './transiciones.js';

// Variables globales
let currentTransition = 'none';
let isProcessing = false;
let isPlaying = false;
let currentClipIndex = 0;
let totalDuration = 0;
let currentTime = 0;
let selectedClipIndex = 0;

const timeline = document.getElementById("timeline");
const canvas = document.getElementById('preview-canvas');
const ctx = canvas.getContext('2d');
const queue = new ProcessingQueue();

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  setupTransitions();
  setupTimelineDragDrop();
  setupKeyboardNavigation();
  setupMouseNavigation();
  setupScrollNavigation();
});

function setupKeyboardNavigation() {
  document.addEventListener('keydown', (e) => {
    const clips = Array.from(timeline.children);
    if (!clips.length) return;

    switch(e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        navigateClips('left');
        break;
      case 'ArrowRight':
        e.preventDefault();
        navigateClips('right');
        break;
      case 'Enter':
        e.preventDefault();
        togglePlayPause();
        break;
      case ' ':
        e.preventDefault();
        togglePlayPause();
        break;
    }
  });
}

function navigateClips(direction) {
  const clips = Array.from(timeline.children);
  if (!clips.length) return;

  // Remover selección actual
  clips[selectedClipIndex]?.classList.remove('selected');

  // Actualizar índice
  if (direction === 'left') {
    selectedClipIndex = Math.max(0, selectedClipIndex - 1);
  } else {
    selectedClipIndex = Math.min(clips.length - 1, selectedClipIndex + 1);
  }

  // Seleccionar nuevo clip
  const selectedClip = clips[selectedClipIndex];
  selectedClip.classList.add('selected');
  
  // Scroll suave al clip seleccionado
  selectedClip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  
  // Actualizar preview
  currentClipIndex = selectedClipIndex;
  updatePreview();
}

function setupMouseNavigation() {
  timeline.addEventListener('click', (e) => {
    const clickedClip = e.target.closest('.clip');
    if (!clickedClip) return;

    const clips = Array.from(timeline.children);
    clips.forEach(clip => clip.classList.remove('selected'));
    
    clickedClip.classList.add('selected');
    selectedClipIndex = clips.indexOf(clickedClip);
    currentClipIndex = selectedClipIndex;
    updatePreview();
  });
}

function setupScrollNavigation() {
  let isScrolling;
  
  timeline.addEventListener('scroll', (e) => {
    window.clearTimeout(isScrolling);
    
    isScrolling = setTimeout(() => {
      const clips = Array.from(timeline.children);
      const timelineRect = timeline.getBoundingClientRect();
      
      let nearestClip = null;
      let nearestDistance = Infinity;
      
      clips.forEach((clip, index) => {
        const clipRect = clip.getBoundingClientRect();
        const distance = Math.abs(clipRect.left - timelineRect.left);
        
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestClip = clip;
          selectedClipIndex = index;
        }
      });
      
      if (nearestClip) {
        clips.forEach(clip => clip.classList.remove('selected'));
        nearestClip.classList.add('selected');
        currentClipIndex = selectedClipIndex;
        updatePreview();
      }
    }, 150);
  });
}

function setupEventListeners() {
  const upload = document.getElementById("upload");
  const addAudio = document.getElementById("add-audio");
  const saveProject = document.getElementById("save-project");
  const playPauseBtn = document.getElementById('playPauseBtn');
  const stopBtn = document.getElementById('stopBtn');
  const progressBar = document.getElementById('progress-bar');
  const exportVideo = document.getElementById('export-video');
  const trimBtn = document.getElementById('trim-btn');
  const textBtn = document.getElementById('text-btn');
  const rotateBtn = document.getElementById('rotate-btn');

  if (upload) upload.addEventListener("change", handleFileUpload);
  if (addAudio) addAudio.addEventListener("click", handleAudioAdd);
  if (saveProject) saveProject.addEventListener("click", saveProject);
  if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);
  if (stopBtn) stopBtn.addEventListener('click', stopPreview);
  if (progressBar) progressBar.addEventListener('click', seekTo);
  if (exportVideo) exportVideo.addEventListener('click', exportVideo);
  if (trimBtn) trimBtn.addEventListener('click', showTrimControls);
  if (textBtn) textBtn.addEventListener('click', toggleTextControls);
  if (rotateBtn) rotateBtn.addEventListener('click', rotateSelectedClip);
}


// Funcionalidades principales
async function playPreview() {
  const clips = Array.from(timeline.children);
  if (!clips.length) return;

  while (isPlaying && currentClipIndex < clips.length) {
    const currentClip = clips[currentClipIndex];
    if (!currentClip) break;

    const media = currentClip.querySelector('video, img');
    const audio = currentClip.querySelector('audio');
    
    if (!media) {
      currentClipIndex++;
      continue;
    }

    try {
      if (audio) {
        audio.currentTime = 0;
        await audio.play().catch(err => console.error('Error playing audio:', err));
      }
      
      await handleMediaPlayback(media);
      updateTimeDisplay();
      updatePreview();
    } catch (error) {
      console.error('Error during playback:', error);
      break;
    }
  }
  
  if (currentClipIndex >= clips.length) {
    stopPreview();
    // Detener todos los audios
    clips.forEach(clip => {
      const audio = clip.querySelector('audio');
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
  }
}
async function saveProject() {
  if (isProcessing) {
    alert('Hay un proceso en curso. Por favor espere...');
    return;
  }
  
  try {
    isProcessing = true;
    const clips = Array.from(timeline.children);
    
    if (clips.length === 0) {
      alert('No hay clips para exportar');
      return;
    }

    // Mostrar indicador de progreso
    const progressIndicator = document.createElement('div');
    progressIndicator.className = 'progress-indicator';
    progressIndicator.textContent = 'Procesando video...';
    document.body.appendChild(progressIndicator);

    // Crear un canvas temporal para la exportación
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = 1280;  // 16:9 HD
    exportCanvas.height = 720;
    const exportCtx = exportCanvas.getContext('2d');

    // Configurar el MediaRecorder
    const stream = exportCanvas.captureStream(30);
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=h264',
      videoBitsPerSecond: 8000000
    });

    const chunks = [];
    mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
    
    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'proyecto_video.mp4';
      a.click();
      
      URL.revokeObjectURL(url);
      document.body.removeChild(progressIndicator);
      isProcessing = false;
    };

    mediaRecorder.start();

    // Procesar cada clip
    for (const clip of clips) {
      const media = clip.querySelector('video, img');
      const duration = clip.dataset.type === 'image' ? 3000 : media.duration * 1000;
      
      await new Promise(resolve => {
        if (clip.dataset.type === 'image') {
          exportCtx.drawImage(media, 0, 0, exportCanvas.width, exportCanvas.height);
          setTimeout(resolve, duration);
        } else {
          const renderFrame = () => {
            exportCtx.drawImage(media, 0, 0, exportCanvas.width, exportCanvas.height);
            if (!media.ended) {
              requestAnimationFrame(renderFrame);
            } else {
              resolve();
            }
          };
          media.currentTime = 0;
          media.play();
          renderFrame();
        }
      });
    }

    mediaRecorder.stop();

  } catch (error) {
    console.error('Error al exportar el video:', error);
    alert('Error al exportar el video. Por favor, intenta de nuevo.');
    isProcessing = false;
  }
}
  
  function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
  
    const url = URL.createObjectURL(file);
    const clip = createClipElement(file, url);
    timeline.appendChild(clip);
  
    if (file.type.startsWith("image/")) {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        updatePreview();
        URL.revokeObjectURL(url);
      };
    } else {
      const video = document.createElement("video");
      video.src = url;
      video.controls = true;
      video.onloadeddata = () => {
        updatePreview();
        URL.revokeObjectURL(url);
      };
    }
  }

function createImageElement(url) {
    const img = document.createElement('img');
    img.src = url;
    img.draggable = false;
    return img;
}

function createVideoElement(url) {
  const video = document.createElement('video');
  video.src = url;
  video.muted = true; // Silenciamos el video en la miniatura
  video.loop = true; // Hacemos que el video se repita
  video.autoplay = true; // Reproducción automática
  video.controls = false; // Quitamos los controles en la miniatura
  video.draggable = false;
  video.playsInline = true; // Mejor soporte móvil
  
  // Reproducir el video cuando el mouse está sobre el clip
  video.closest('.clip')?.addEventListener('mouseenter', () => {
      video.play().catch(() => {
          // Manejar error silenciosamente
      });
  });
  
  // Pausar cuando el mouse sale del clip
  video.closest('.clip')?.addEventListener('mouseleave', () => {
      video.pause();
  });
  
  return video;
}
  
function createClipElement(file, url) {
  // Crear el contenedor principal
  const clipContainer = document.createElement('div');
  clipContainer.className = 'clip-container';
  
  // Crear el clip
  const clip = document.createElement("div");
  clip.className = "clip";
  clip.draggable = true;
  clip.dataset.name = file.name;
  clip.dataset.type = file.type.startsWith("image/") ? "image" : "video";

  // Crear y agregar el loader
  const loader = document.createElement('div');
  loader.className = 'clip-loader';
  clip.appendChild(loader);

  // Crear el elemento media (imagen o video)
  const media = file.type.startsWith("image/") 
      ? createImageElement(url)
      : createVideoElement(url);

  const deleteBtn = createDeleteButton(clip);
  const durationDisplay = document.createElement("div");
  durationDisplay.className = "clip-duration";
  
  if (file.type.startsWith("image/")) {
      const duration = document.getElementById("image-duration").value;
      clip.dataset.duration = duration;
      durationDisplay.textContent = `${duration}s`;
      
      // Manejar la carga de imagen
      media.onload = () => {
          clip.removeChild(loader);
          updatePreview();
          URL.revokeObjectURL(url);
      };
  } else {
      // Manejar la carga de video
      media.onloadeddata = () => {
          clip.removeChild(loader);
          updatePreview();
          URL.revokeObjectURL(url);
      };
  }

  clip.appendChild(media);
  clip.appendChild(deleteBtn);
  clip.appendChild(durationDisplay);

  // Eventos de arrastre
  clip.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', clip.dataset.name);
      clip.classList.add('dragging');
      requestAnimationFrame(() => {
          clip.style.opacity = '0.5';
      });
  });

  clip.addEventListener('dragend', (e) => {
      clip.classList.remove('dragging');
      clip.style.opacity = '1';
      updatePreview();
  });

  clip.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
  });

  // Agregar el clip al contenedor y retornar el contenedor
  clipContainer.appendChild(clip);
  return clipContainer;
}
  
  function createDeleteButton(clip) {
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "X";
    deleteBtn.className = "delete-btn";
    deleteBtn.addEventListener("click", () => {
      clip.remove();
      updatePreview();
    });
    return deleteBtn;
  }
  

  function rotateSelectedClip() {
    const selectedClip = timeline.querySelector('.clip.selected');
    if (!selectedClip) {
        alert('Por favor, selecciona un clip primero');
        return;
    }

    const currentRotation = parseInt(selectedClip.dataset.rotation || '0');
    const newRotation = (currentRotation + 90) % 360;
    selectedClip.dataset.rotation = newRotation;

    // Actualizar la vista previa con la nueva rotación
    const media = selectedClip.querySelector('video, img');
    if (media) {
        media.style.transform = `rotate(${newRotation}deg)`;
        media.style.transformOrigin = 'center center';
    }

    // Actualizar el currentClipIndex para asegurar que la previsualización muestre el clip correcto
    const clips = Array.from(timeline.children);
    currentClipIndex = clips.findIndex(clipContainer => 
        clipContainer.querySelector('.clip.selected') === selectedClip
    );

    // Forzar una actualización inmediata de la previsualización
    if (currentClipIndex !== -1) {
        ctx.save();
        updatePreview();
        ctx.restore();
    }
}


function updatePreview() {
  const clips = Array.from(timeline.children);
  if (clips.length === 0 || currentClipIndex >= clips.length) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
  }

  const currentClipContainer = clips[currentClipIndex];
  if (!currentClipContainer) return;

  const currentClip = currentClipContainer.querySelector('.clip');
  if (!currentClip) return;

  const media = currentClip.querySelector('video') || currentClip.querySelector('img');
  if (!media) return;

    // Establecer dimensiones fijas para el canvas de previsualización
    const previewWidth = 1280;  // 16:9 aspect ratio
    const previewHeight = 720;
    
    canvas.width = previewWidth;
    canvas.height = previewHeight;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    try {
        // Calcular dimensiones para mantener la relación de aspecto
        let drawWidth = previewWidth;
        let drawHeight = previewHeight;
        let offsetX = 0;
        let offsetY = 0;

        const mediaWidth = media.tagName === 'IMG' ? media.naturalWidth : media.videoWidth;
        const mediaHeight = media.tagName === 'IMG' ? media.naturalHeight : media.videoHeight;
        
        if (mediaWidth && mediaHeight) {
            const mediaRatio = mediaWidth / mediaHeight;
            const canvasRatio = previewWidth / previewHeight;
            
            if (mediaRatio > canvasRatio) {
                drawHeight = previewWidth / mediaRatio;
                offsetY = (previewHeight - drawHeight) / 2;
            } else {
                drawWidth = previewHeight * mediaRatio;
                offsetX = (previewWidth - drawWidth) / 2;
            }
        }

        // Dibujar fondo negro
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, previewWidth, previewHeight);
        
        ctx.save();
        
        // Aplicar rotación si existe
        if (currentClip.dataset.rotation) {
          const rotation = parseInt(currentClip.dataset.rotation);
          ctx.translate(canvas.width/2, canvas.height/2);
          ctx.rotate((rotation * Math.PI) / 180);
          ctx.translate(-canvas.width/2, -canvas.height/2);
      }

        // Dibujar el medio con recorte si existe
        if (currentClip.dataset.trimStart || currentClip.dataset.trimEnd) {
            const trimStart = parseFloat(currentClip.dataset.trimStart) || 0;
            if (media.tagName === 'VIDEO') {
                media.currentTime = trimStart + (currentTime % (media.duration - trimStart));
            }
        }
        
        ctx.drawImage(media, offsetX, offsetY, drawWidth, drawHeight);
        
        // Aplicar texto con posición personalizada
        if (currentClip.dataset.text) {
          // Restaurar la transformación antes de dibujar el texto
          ctx.restore();
          ctx.save();
          
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = currentClip.dataset.textColor || '#ffffff';
          ctx.font = `${currentClip.dataset.textSize || '24'}px Arial`;
          
          const textX = (parseFloat(currentClip.dataset.textX) || 50) * canvas.width / 100;
          const textY = (parseFloat(currentClip.dataset.textY) || 50) * canvas.height / 100;
          
          ctx.fillText(currentClip.dataset.text, textX, textY);
      }
      
      ctx.restore();
  } catch (error) {
      console.error('Error al actualizar la previsualización:', error);
  }
    
    // Actualizar la previsualización continuamente para videos
    if (isPlaying && media?.tagName === 'VIDEO') {
        requestAnimationFrame(updatePreview);
    }
}


function updateTimeDisplay() {
  const timeDisplay = document.getElementById('time-display');
  const progress = document.getElementById('progress');
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  if (timeDisplay && progress) {
    timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(totalDuration)}`;
    progress.style.width = `${(currentTime / totalDuration) * 100}%`;
  }
}

function toggleTextControls() {
    const textControls = document.getElementById('text-controls');
    const selectedClip = timeline.querySelector('.clip.selected');
    
    if (!selectedClip) {
        alert('Selecciona un clip para añadir texto');
        return;
    }
    
    textControls.style.display = textControls.style.display === 'none' ? 'block' : 'none';
    
    if (textControls.style.display === 'block') {
        const clipText = document.getElementById('clip-text');
        const textColor = document.getElementById('text-color');
        const textSize = document.getElementById('text-size');
        
        clipText.value = selectedClip.dataset.text || '';
        textColor.value = selectedClip.dataset.textColor || '#ffffff';
        textSize.value = selectedClip.dataset.textSize || '24';
        
        setupTextControlEvents(selectedClip);
    }
}
function setupTextControlEvents(selectedClip) {
  const clipText = document.getElementById('clip-text');
  const textColor = document.getElementById('text-color');
  const textSize = document.getElementById('text-size');
  
  // Hacer el texto arrastrable
  let isDragging = false;
  let startX, startY;
  
  const updateTextProperties = () => {
      selectedClip.dataset.text = clipText.value;
      selectedClip.dataset.textColor = textColor.value;
      selectedClip.dataset.textSize = textSize.value;
      selectedClip.dataset.textX = selectedClip.dataset.textX || '50';
      selectedClip.dataset.textY = selectedClip.dataset.textY || '50';
      updatePreview();
  };
  
  // Agregar eventos de arrastre al canvas
  canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / canvas.width) * 100;
      const y = ((e.clientY - rect.top) / canvas.height) * 100;
      
      // Verificar si el clic está cerca del texto
      const textX = parseFloat(selectedClip.dataset.textX || '50');
      const textY = parseFloat(selectedClip.dataset.textY || '50');
      
      if (Math.abs(x - textX) < 5 && Math.abs(y - textY) < 5) {
          isDragging = true;
          startX = x;
          startY = y;
      }
  });
  
  canvas.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / canvas.width) * 100;
      const y = ((e.clientY - rect.top) / canvas.height) * 100;
      
      selectedClip.dataset.textX = x.toString();
      selectedClip.dataset.textY = y.toString();
      updatePreview();
  });
  
  canvas.addEventListener('mouseup', () => {
      isDragging = false;
  });
  
  canvas.addEventListener('mouseleave', () => {
      isDragging = false;
  });
  
  clipText.addEventListener('input', updateTextProperties);
  textColor.addEventListener('input', updateTextProperties);
  textSize.addEventListener('input', updateTextProperties);
}

function togglePlayPause() {
  isPlaying = !isPlaying;
  const playPauseBtn = document.getElementById('playPauseBtn');
  playPauseBtn.textContent = isPlaying ? '⏸' : '⏵';
  
  if (isPlaying) {
    playPreview();
  }
}

function stopPreview() {
  isPlaying = false;
  currentTime = 0;
  currentClipIndex = 0;
  
  // Detener y reiniciar todos los audios
  const clips = Array.from(timeline.children);
  clips.forEach(clip => {
    const audio = clip.querySelector('audio');
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  });
  
  document.getElementById('playPauseBtn').textContent = '⏵';
  updateTimeDisplay();
  updatePreview();
}

function handleMediaPlayback(media) {
  return new Promise(resolve => {
    if (media.tagName === 'VIDEO') {
      media.currentTime = currentTime % media.duration;
      media.play();
      media.onended = () => {
        currentTime += media.duration;
        currentClipIndex++;
        resolve();
      };
    } else {
      // Para imágenes, mostrar durante 3 segundos
      setTimeout(() => {
        currentTime += 3;
        currentClipIndex++;
        resolve();
      }, 3000);
    }
  });
}

function seekTo(event) {
  const rect = event.target.getBoundingClientRect();
  const pos = (event.clientX - rect.left) / rect.width;
  currentTime = pos * totalDuration;
  currentClipIndex = 0;
  let accumTime = 0;
  
  const clips = Array.from(timeline.children);
  for (let i = 0; i < clips.length; i++) {
    const media = clips[i].querySelector('video') || clips[i].querySelector('img');
    const clipDuration = media.tagName === 'VIDEO' ? media.duration : 3;
    accumTime += clipDuration;
    if (accumTime > currentTime) {
      currentClipIndex = i;
      break;
    }
  }
  
  updateTimeDisplay();
  updatePreview();
}

function setupTimelineDragDrop() {
  timeline.addEventListener('dragover', (e) => {
    e.preventDefault();
    const afterElement = getDragAfterElement(timeline, e.clientX);
    const draggable = document.querySelector('.dragging');
    
    if (draggable) {
      if (afterElement) {
        timeline.insertBefore(draggable, afterElement);
      } else {
        timeline.appendChild(draggable);
      }
    }
  });

  timeline.addEventListener('drop', (e) => {
    e.preventDefault();
    const clips = Array.from(timeline.children);
    clips.forEach(clip => clip.classList.remove('dragging'));
    updatePreview();
  });

  // Prevenir el comportamiento por defecto del clic en el timeline
  timeline.addEventListener('click', (e) => {
    // Solo permitir clics en los clips o sus elementos internos
    const clickedClip = e.target.closest('.clip');
    if (!clickedClip) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  });
}
function getDragAfterElement(container, x) {
  const draggableElements = [...container.querySelectorAll('.clip:not(.dragging)')];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = x - box.left - box.width / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function handleAudioAdd() {
  const audioInput = document.getElementById('audio');
  const file = audioInput.files[0];
  
  if (!file) {
    alert('Por favor, selecciona un archivo de audio primero');
    return;
  }

  if (!file.type.startsWith('audio/')) {
    alert('Por favor, selecciona un archivo de audio válido');
    return;
  }

  const audioElement = document.createElement('audio');
  const audioUrl = URL.createObjectURL(file);
  audioElement.src = audioUrl;
  audioElement.controls = true;
  
  // Crear un contenedor para el clip de audio
  const audioClip = document.createElement('div');
  audioClip.className = 'clip audio-clip';
  audioClip.draggable = true;
  audioClip.dataset.name = file.name;
  audioClip.dataset.type = 'audio';
  audioClip.dataset.url = audioUrl;
  
  // Agregar controles de audio personalizados
  const audioControls = document.createElement('div');
  audioControls.className = 'audio-custom-controls';
  
  audioElement.addEventListener('loadedmetadata', () => {
    // Actualizar el valor máximo del input de fin
    document.getElementById('audio-end').value = audioElement.duration;
    document.getElementById('audio-end').max = audioElement.duration;
    
    // Configurar la duración inicial
    audioClip.dataset.duration = audioElement.duration;
    audioClip.dataset.startTime = 0;
    audioClip.dataset.endTime = audioElement.duration;
    
    const durationDisplay = document.createElement('div');
    durationDisplay.className = 'clip-duration';
    durationDisplay.textContent = `${Math.round(audioElement.duration)}s`;
    audioClip.appendChild(durationDisplay);
  });
  
  // Agregar eventos para los controles de audio
  document.getElementById('audio-start').addEventListener('change', (e) => {
    if (audioClip.classList.contains('selected')) {
      const startTime = parseFloat(e.target.value);
      audioClip.dataset.startTime = startTime;
      audioElement.currentTime = startTime;
    }
  });
  
  document.getElementById('audio-end').addEventListener('change', (e) => {
    if (audioClip.classList.contains('selected')) {
      const endTime = parseFloat(e.target.value);
      audioClip.dataset.endTime = endTime;
      audioClip.dataset.duration = endTime - parseFloat(audioClip.dataset.startTime);
      audioClip.querySelector('.clip-duration').textContent = 
        `${Math.round(audioClip.dataset.duration)}s`;
    }
  });
  
  document.getElementById('audio-volume').addEventListener('input', (e) => {
    if (audioClip.classList.contains('selected')) {
      audioElement.volume = parseFloat(e.target.value);
    }
  });
  
  // Agregar elementos al clip
  const audioLabel = document.createElement('div');
  audioLabel.className = 'audio-label';
  audioLabel.textContent = file.name;
  
  const deleteBtn = createDeleteButton(audioClip);
  
  audioClip.appendChild(audioLabel);
  audioClip.appendChild(audioElement);
  audioClip.appendChild(deleteBtn);
  
  // Agregar el clip al timeline
  timeline.appendChild(audioClip);
  
  // Limpiar el input de archivo
  audioInput.value = '';
  
  // Agregar evento de selección
  audioClip.addEventListener('click', () => {
    document.querySelectorAll('.clip').forEach(clip => clip.classList.remove('selected'));
    audioClip.classList.add('selected');
    
    // Actualizar los controles con los valores actuales
    document.getElementById('audio-start').value = audioClip.dataset.startTime || 0;
    document.getElementById('audio-end').value = audioClip.dataset.endTime || audioElement.duration;
    document.getElementById('audio-volume').value = audioElement.volume;
  });
}

function showTrimControls() {
  const selectedClip = timeline.querySelector('.clip.selected');
  if (!selectedClip) {
      alert('Selecciona un clip para recortar');
      return;
  }

  // Buscar el contenedor del clip
  const clipContainer = selectedClip.closest('.clip-container');
  
  // Remover controles existentes si los hay
  const existingControls = clipContainer.querySelector('.trim-controls');
  if (existingControls) {
      existingControls.remove();
  }

  const trimControls = document.createElement('div');
  trimControls.className = 'trim-controls';
  trimControls.innerHTML = `
      <div class="trim-slider">
          <input type="range" class="trim-start" min="0" step="0.1" value="0">
          <input type="range" class="trim-end" min="0" step="0.1" value="100">
      </div>
      <div class="trim-times">
          <span class="trim-start-time">0:00</span>
          <span class="trim-end-time">0:00</span>
      </div>
  `;

  clipContainer.appendChild(trimControls);

  const media = selectedClip.querySelector('video, img');
  const duration = media.tagName === 'VIDEO' ? media.duration : 3;
  
  const startSlider = trimControls.querySelector('.trim-start');
  const endSlider = trimControls.querySelector('.trim-end');
  
  startSlider.max = duration;
  endSlider.max = duration;
  endSlider.value = duration;

  setupTrimEvents(selectedClip, trimControls);
}

function setupTrimEvents(clip, controls) {
  const startSlider = controls.querySelector('.trim-start');
  const endSlider = controls.querySelector('.trim-end');
  const startTime = controls.querySelector('.trim-start-time');
  const endTime = controls.querySelector('.trim-end-time');
  const media = clip.querySelector('video, img');

  const formatTime = (time) => {
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const updateTrimTimes = () => {
      const start = parseFloat(startSlider.value);
      const end = parseFloat(endSlider.value);
      
      if (start >= end) {
          startSlider.value = end - 0.1;
          return;
      }
      
      startTime.textContent = formatTime(start);
      endTime.textContent = formatTime(end);
      
      clip.dataset.trimStart = start;
      clip.dataset.trimEnd = end;
      
      if (media.tagName === 'VIDEO') {
          media.currentTime = start;
      }
      
      updatePreview();
  };

  startSlider.addEventListener('input', updateTrimTimes);
  endSlider.addEventListener('input', updateTrimTimes);
}