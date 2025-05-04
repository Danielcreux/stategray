export class ProcessingQueue {
    constructor() {
      this.jobs = [];
      this.isProcessing = false;
      this.progress = 0;
    }
  
    addJob(job) {
      this.jobs.push(job);
      if (!this.isProcessing) this.processNext();
    }
  
    async processNext() {
      if (!this.jobs.length) return;
      
      this.isProcessing = true;
      const job = this.jobs.shift();
      
      try {
        await job.task();
        this.progress += job.weight;
        updateProgress(this.progress);
      } catch (error) {
        console.error('Processing error:', error);
      }
      
      this.isProcessing = false;
      this.processNext();
    }
  }
  
  function updateProgress(percentage) {
    const progressBar = document.getElementById('progress');
    progressBar.style.width = `${percentage}%`;
  }