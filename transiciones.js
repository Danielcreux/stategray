const TRANSITION_DURATION = 1000;

export function setupTransitions() {
  document.querySelectorAll('.transition-option').forEach(option => {
    option.addEventListener('click', () => applyTransition(option.dataset.transition));
  });
}

export function applyCanvasTransition(ctx, canvas, media, nextMedia) {
  let startTime = Date.now();
  
  const animate = () => {
    const progress = (Date.now() - startTime) / TRANSITION_DURATION;
    
    if (progress >= 1) {
      ctx.drawImage(nextMedia, 0, 0, canvas.width, canvas.height);
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    applyTransitionEffect(ctx, canvas, media, nextMedia, progress);
    requestAnimationFrame(animate);
  };

  requestAnimationFrame(animate);
}

function applyTransitionEffect(ctx, canvas, media, nextMedia, progress) {
  switch(currentTransition) {
    case 'fade':
      ctx.globalAlpha = 1 - progress;
      ctx.drawImage(media, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = progress;
      ctx.drawImage(nextMedia, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
      break;

    case 'slide':
      ctx.drawImage(media, -canvas.width * progress, 0, canvas.width, canvas.height);
      ctx.drawImage(nextMedia, canvas.width * (1 - progress), 0, canvas.width, canvas.height);
      break;

    case 'zoom':
      const scale = 1 + (progress * 0.5);
      ctx.save();
      ctx.translate(canvas.width/2, canvas.height/2);
      ctx.scale(scale, scale);
      ctx.drawImage(media, -canvas.width/2, -canvas.height/2, canvas.width, canvas.height);
      ctx.restore();
      ctx.globalAlpha = progress;
      ctx.drawImage(nextMedia, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
      break;
  }
}