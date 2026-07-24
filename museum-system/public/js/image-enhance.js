// Lightweight client-side image sharpening using canvas convolution
(function(){
  function convolve(pixels, weights){
    const side = Math.round(Math.sqrt(weights.length));
    const half = Math.floor(side/2);
    const src = pixels.data;
    const sw = pixels.width;
    const sh = pixels.height;
    const output = new Uint8ClampedArray(src.length);

    for(let y=0; y<sh; y++){
      for(let x=0; x<sw; x++){
        let r=0,g=0,b=0,a=0;
        for(let ky=0; ky<side; ky++){
          for(let kx=0; kx<side; kx++){
            const scy = y + ky - half;
            const scx = x + kx - half;
            if(scy>=0 && scy<sh && scx>=0 && scx<sw){
              const srcOff = (scy*sw + scx)*4;
              const wt = weights[ky*side + kx];
              r += src[srcOff] * wt;
              g += src[srcOff+1] * wt;
              b += src[srcOff+2] * wt;
              a += src[srcOff+3] * wt;
            }
          }
        }
        const off = (y*sw + x)*4;
        output[off] = Math.min(255, Math.max(0, r));
        output[off+1] = Math.min(255, Math.max(0, g));
        output[off+2] = Math.min(255, Math.max(0, b));
        output[off+3] = 255;
      }
    }
    return new ImageData(output, sw, sh);
  }

  function enhanceImageElement(img){
    if(!img || img.dataset.enhanced) return;
    const maxW = 1200;
    const naturalW = img.naturalWidth || img.width;
    const naturalH = img.naturalHeight || img.height;
    if(!naturalW || !naturalH) return;

    const canvas = document.createElement('canvas');
    const scale = Math.min(1, maxW / naturalW);
    canvas.width = Math.round(naturalW * scale);
    canvas.height = Math.round(naturalH * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    try{
      const imgData = ctx.getImageData(0,0,canvas.width,canvas.height);
      // simple sharpen kernel
      const kernel = [0,-1,0,-1,5,-1,0,-1,0];
      const out = convolve(imgData, kernel);
      ctx.putImageData(out, 0, 0);
      img.src = canvas.toDataURL('image/jpeg', 0.9);
      img.dataset.enhanced = '1';
    }catch(e){
      // cross-origin images may throw — skip
    }
  }

  function enhanceAll(){
    document.querySelectorAll('img.img-enhance').forEach(img=>{
      if(img.complete) enhanceImageElement(img);
      else img.addEventListener('load', ()=>enhanceImageElement(img));
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enhanceAll);
  else enhanceAll();
})();
