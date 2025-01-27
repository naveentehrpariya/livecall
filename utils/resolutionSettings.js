const resolutionSettings = {
  '2160p': {
    resolution: '3840x2160',
    videoBitrate: '15000k',
    maxrate: '22500k',
    bufsize: '30000k',
    preset: 'medium',
    gop: '120', // 2 seconds at 60fps
  },
  '1080p': {
    resolution: '1920x1080',
    videoBitrate: '4000k',
    maxrate: '6000k',
    bufsize: '8000k',
    preset: 'fast',
    gop: '60', // 2 seconds at 30fps
  },
  '720p': {
    resolution: '1280x720',
    videoBitrate: '3000k',
    maxrate: '4500k',
    bufsize: '6000k',
    preset: 'faster',
    gop: '60', // 2 seconds at 30fps
  },
  '720x1080': {
    resolution: '720x1080',
    videoBitrate: '3500k',
    maxrate: '5000k',
    bufsize: '7000k',
    preset: 'fast',
    gop: '60', // 2 seconds at 30fps
  },
};

module.exports = resolutionSettings;
