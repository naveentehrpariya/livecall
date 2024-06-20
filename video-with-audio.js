const force_start_stream = async (req, res, next) => {
   try {
     const { streamkey, audios, thumbnail, playMode, videos, resolution: resolutionKey = '1080p' } = req.body;
     const { resolution, videoBitrate, maxrate, bufsize, preset, gop } = resolutionSettings[resolutionKey];

     const playlistPath = await createVideoPlaylist(videos, streamkey);

     const directoryPath = path.dirname(playlistPath);
     if (!fs.existsSync(directoryPath)) {
       return next(new Error('Directory does not exist'));
     }
     let ffmpegCommand = [
       '-re',
       '-stream_loop', '-1',
       '-i', playlistPath,
       '-vf', `scale=${resolution}`,
       '-c:v', 'libx264',
       '-preset', preset,
       '-tune', 'zerolatency',
       '-pix_fmt', 'yuv420p',
       '-b:v', videoBitrate,
       '-maxrate', maxrate,
       '-bufsize', bufsize,
       '-r', '30',
       '-g', gop,
       '-use_wallclock_as_timestamps', '1',
       '-err_detect', 'ignore_err',
       '-avoid_negative_ts', 'make_zero',
       '-strict', '-2',
       '-f', 'flv',
       `rtmp://a.rtmp.youtube.com/live2/${streamkey}`
     ];
 
     const audioPath = audios && audios[0];
     console.log("audioPath",audioPath);
     // Check if custom audio is provided
     if (audios && audios.length > 0) {
 
       ffmpegCommand = [
         '-re',
         '-stream_loop', '-1',
         '-i', audioPath, // Add audio input
         '-stream_loop', '-1',
         '-i', playlistPath, // Add video input
         '-vf', `scale=${resolution}`,
         '-c:v', 'libx264',
         '-preset', preset,
         '-tune', 'zerolatency',
         '-pix_fmt', 'yuv420p',
         '-b:v', videoBitrate,
         '-maxrate', maxrate,
         '-bufsize', bufsize,
         '-r', '30',
         '-g', gop,
         '-c:a', 'aac',
         '-b:a', '128k',
         '-ar', '44100',
         '-map', '1:v', // Map video from the second input (playlist)
         '-map', '0:a', // Map audio from the first input (custom audio)
         '-use_wallclock_as_timestamps', '1',
         '-err_detect', 'ignore_err',
         '-avoid_negative_ts', 'make_zero',
         '-strict', '-2',
         '-f', 'flv',
         `rtmp://a.rtmp.youtube.com/live2/${streamkey}`
       ];
     } else {
       // Default audio settings if no custom audio provided
       ffmpegCommand.splice(ffmpegCommand.indexOf('-strict'), 0, '-c:a', 'aac', '-b:a', '128k', '-ar', '44100');
     }
 
     const startFFmpegProcess = () => {
       const child = execFile('ffmpeg', ffmpegCommand, { detached: true });
 
       child.on('close', (code) => {
         console.log(`FFmpeg process exited with code ${code}`);
         if (code !== 0) {
           console.error('FFmpeg process exited unexpectedly, restarting...');
           // Implement a delay before restarting to avoid immediate restart loops
           setTimeout(startFFmpegProcess, 5000);
         }
       });
 
       child.stdout.on('data', (data) => console.log(`stdout: ${data}`));
       child.stderr.on('data', (data) => {
         console.error(`stderr: ${data}`);
         if (data.includes('HTTP error 404 Not Found')) {
           console.error('The provided video URL returned a 404 error');
         }
       });
 
       child.on('error', (err) => {
         console.error(`Child process error: ${err}`);
         next(err);
       });
     };
 
     startFFmpegProcess();
 
     res.json({ message: 'Stream started successfully' });
   } catch (err) {
     next(err);
   }
 };