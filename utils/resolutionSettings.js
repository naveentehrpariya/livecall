const resolutionSettings = {
  '2160p': {
    resolution: '3840x2160',
    videoBitrate: '12000k',
    maxrate: '18000k',
    bufsize: '24000k',
    preset: 'medium',
    gop: '120',
  },
  '1080p': {
    resolution: '1920x1080',
    videoBitrate: '4500k',
    maxrate: '6000k',
    bufsize: '9000k',
    preset: 'fast',
    gop: '60',
  },
  '720p': {
    resolution: '1280x720',
    videoBitrate: '2500k',
    maxrate: '3500k',
    bufsize: '5000k',
    preset: 'faster',
    gop: '60',
  },
  '720x1080': {
    resolution: '720x1080',
    videoBitrate: '3000k',
    maxrate: '4000k',
    bufsize: '5000k',
    preset: 'fast',
    gop: '60',
  },
};

module.exports = resolutionSettings;
