function get_randNum(minimo,maximo){
    minimo = Math.ceil(minimo);
    maximo = Math.floor(maximo);

    return Math.floor(Math.random() * (maximo - minimo + 1)) + minimo;
}

function get_untouchedPix(image_dataArr,diffum_color,channels,width){

    
    let untouched_pix=[]

    for (let i=0;i<image_dataArr.length;i+=channels){
        pixelColor=image_dataArr.slice(i,i+channels);
        
        // Check if pixel is NOT transparent (alpha > 0)
        let isTransparent = channels === 4 && pixelColor[3] === 0;
        
        if (!isTransparent){
            let x=Math.floor(i/channels % width);
            let y=Math.floor(i/channels / width);
            untouched_pix.push([x,y]);
        }

    }
    return untouched_pix
}

function changePixel(x,y,new_color,imgArr,imgInfo){
    // Calcular el índice del píxel en el buffer
    const indice = (y * imgInfo.width + x) * imgInfo.channels;

    // Modificar los valores RGB
    imgArr[indice] = new_color[0];
    imgArr[indice + 1] = new_color[1];
    imgArr[indice + 2] = new_color[2];

    // Si hay canal alpha (RGBA) y se proporciona en new_color, modificarlo
    if (imgInfo.channels === 4) {
        imgArr[indice + 3] = new_color[3] !== undefined ? new_color[3] : 255;
    }
}

function delete_arrElem(index,arr){
    arr.splice(index,1);
}


module.exports={get_randNum,get_untouchedPix,changePixel,delete_arrElem};