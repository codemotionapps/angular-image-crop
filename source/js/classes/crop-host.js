const ColorThief = require(`@codemotion/color-thief`);

cropHost.$inject = [
	`$document`,
	`$q`,
	`cropAreaCircle`,
	`cropAreaSquare`,
	`cropAreaRectangle`,
	`cropEXIF`
];
function cropHost($document, $q, CropAreaCircle, CropAreaSquare, CropAreaRectangle, cropEXIF){
	/* STATIC FUNCTIONS */
	let colorPaletteLength = 8;

	// Get Element's Offset
	const getElementOffset = function(elem){
		const box = elem.getBoundingClientRect();

		const body = document.body;
		const docElem = document.documentElement;

		const scrollTop = window.pageYOffset || docElem.scrollTop || body.scrollTop;
		const scrollLeft = window.pageXOffset || docElem.scrollLeft || body.scrollLeft;

		const clientTop = docElem.clientTop || body.clientTop || 0;
		const clientLeft = docElem.clientLeft || body.clientLeft || 0;

		const top = box.top + scrollTop - clientTop;
		const left = box.left + scrollLeft - clientLeft;

		return {
			top: Math.round(top),
			left: Math.round(left)
		};
	};

	return function(elCanvas, _, events){
		/* PRIVATE VARIABLES */

		// Object Pointers
		let ctx = null;
		let image = null;
		let theArea = null;
		let initMax = null;
		let isAspectRatio = null;
		const self = this;

		// Dimensions
		let minCanvasDims = [100, 100];
		let maxCanvasDims = [300, 300];

		let scalemode = null;

		// Result Image size
		let resImgSizeArray = [];
		let resImgSize = {
			w: 200,
			h: 200
		};
		let areaMinRelativeSize = null;

		// Result Image type
		let resImgFormat = `image/png`;

		// Result Image quality
		let resImgQuality = null;

		let forceAspectRatio = false;

		/* PRIVATE FUNCTIONS */
		this.setInitMax = function(bool){
			initMax = bool;
		};
		this.setAllowCropResizeOnCorners = function(bool){
			theArea.setAllowCropResizeOnCorners(bool);
		};
		// Draw Scene
		function drawScene(){
			// clear canvas
			ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

			if(image !== null){
				// draw source image
				ctx.drawImage(image, 0, 0, ctx.canvas.width, ctx.canvas.height);

				ctx.save();

				// and make it darker
				ctx.fillStyle = `rgba(0, 0, 0, 0.65)`;
				ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

				ctx.restore();

				// draw Area
				theArea.draw();
			}
		}

		// Resets CropHost
		const resetCropHost = function(){
			if(image !== null){
				theArea.setImage(image);
				const imageDims = [image.width, image.height];
				const imageRatio = image.width / image.height;
				const canvasDims = imageDims;

				if(canvasDims[0] > maxCanvasDims[0]){
					canvasDims[0] = maxCanvasDims[0];
					canvasDims[1] = canvasDims[0] / imageRatio;
				}else if(canvasDims[0] < minCanvasDims[0]){
					canvasDims[0] = minCanvasDims[0];
					canvasDims[1] = canvasDims[0] / imageRatio;
				}
				if(scalemode === `fixed-height` && canvasDims[1] > maxCanvasDims[1]){
					canvasDims[1] = maxCanvasDims[1];
					canvasDims[0] = canvasDims[1] * imageRatio;
				}else if(canvasDims[1] < minCanvasDims[1]){
					canvasDims[1] = minCanvasDims[1];
					canvasDims[0] = canvasDims[1] * imageRatio;
				}
				elCanvas.prop(`width`, canvasDims[0]).prop(`height`, canvasDims[1]);
				if(scalemode === `fixed-height`){
					elCanvas.css({
						'margin-left': - (canvasDims[0] / 2) + `px`,
						'margin-top': - (canvasDims[1] / 2) + `px`
					});
				}

				let cw = ctx.canvas.width;
				let ch = ctx.canvas.height;

				const areaType = self.getAreaType();
				// enforce 1:1 aspect ratio for square-like selections
				if((areaType === `circle`) || (areaType === `square`)){
					if(ch < cw){
						cw = ch;
					}
					ch = cw;
				}else if(areaType === `rectangle` && isAspectRatio){
					const aspectRatio = theArea.getAspect(); // use `aspectRatio` instead of `resImgSize` dimensions bc `resImgSize` can be 'selection' string
					if(cw / ch > aspectRatio){
						cw = aspectRatio * ch;
					}else{
						ch = aspectRatio * cw;
					}
				}

				if(initMax){
					theArea.setSize({
						w: cw,
						h: ch
					});
				}else if(undefined !== theArea.getInitSize()){
					theArea.setSize({
						w: Math.min(theArea.getInitSize().w, cw / 2),
						h: Math.min(theArea.getInitSize().h, ch / 2)
					});
				}else{
					theArea.setSize({
						w: Math.min(200, cw / 2),
						h: Math.min(200, ch / 2)
					});
				}

				if(theArea.getInitCoords()){
					if(self.areaInitIsRelativeToImage){
						const ratio = image.width / canvasDims[0];
						theArea.setSize({
							w: theArea.getInitSize().w / ratio,
							h: theArea.getInitSize().h / ratio,
							x: theArea.getInitCoords().x / ratio,
							y: theArea.getInitCoords().y / ratio
						});
					}else{
						theArea.setSize({
							w: theArea.getSize().w,
							h: theArea.getSize().h,
							x: theArea.getInitCoords().x,
							y: theArea.getInitCoords().y
						});
					}
				}else{
					theArea.setCenterPoint({
						x: ctx.canvas.width / 2,
						y: ctx.canvas.height / 2
					});
				}
			}else{
				elCanvas.prop(`width`, 0).prop(`height`, 0).css({
					'margin-top': 0
				});
			}

			drawScene();
		};

		const getChangedTouches = function(event){
			if(angular.isDefined(event.changedTouches)){
				return event.changedTouches;
			}else{
				return event.originalEvent.changedTouches;
			}
		};

		const onMouseMove = function(e){
			if(image !== null){
				const offset = getElementOffset(ctx.canvas);
				let pageX;
				let pageY;
				if(e.type === `touchmove`){
					pageX = getChangedTouches(e)[0].pageX;
					pageY = getChangedTouches(e)[0].pageY;
				}else{
					pageX = e.pageX;
					pageY = e.pageY;
				}
				theArea.processMouseMove(pageX - offset.left, pageY - offset.top);
				drawScene();
			}
		};

		const onMouseDown = function(e){
			e.preventDefault();
			e.stopPropagation();
			if(image !== null){
				const offset = getElementOffset(ctx.canvas);
				let pageX;
				let pageY;
				if(e.type === `touchstart`){
					pageX = getChangedTouches(e)[0].pageX;
					pageY = getChangedTouches(e)[0].pageY;
				}else{
					pageX = e.pageX;
					pageY = e.pageY;
				}
				theArea.processMouseDown(pageX - offset.left, pageY - offset.top);
				drawScene();
			}
		};

		const onMouseUp = function(e){
			if(image !== null){
				const offset = getElementOffset(ctx.canvas);
				let pageX;
				let pageY;
				if(e.type === `touchend`){
					pageX = getChangedTouches(e)[0].pageX;
					pageY = getChangedTouches(e)[0].pageY;
				}else{
					pageX = e.pageX;
					pageY = e.pageY;
				}
				theArea.processMouseUp(pageX - offset.left, pageY - offset.top);
				drawScene();
			}
		};

		const renderTempCanvas = function(ris, center){
			const tempCanvas = angular.element(`<canvas></canvas>`)[0];
			const tempCtx = tempCanvas.getContext(`2d`);
			tempCanvas.width = ris.w;
			tempCanvas.height = ris.h;
			if(image !== null){
				const x = (center.x - (theArea.getSize().w / 2)) * (image.width / ctx.canvas.width);
				const y = (center.y - (theArea.getSize().h / 2)) * (image.height / ctx.canvas.height);
				const areaWidth = theArea.getSize().w * (image.width / ctx.canvas.width);
				const areaHeight = theArea.getSize().h * (image.height / ctx.canvas.height);

				if(forceAspectRatio){
					tempCtx.drawImage(image, x, y,
						areaWidth,
						areaHeight,
						0,
						0,
						ris.w,
						ris.h);
				}else{
					const aspectRatio = areaWidth / areaHeight;
					let resultHeight;
					let resultWidth;

					if(aspectRatio > 1){
						resultWidth = ris.w;
						resultHeight = resultWidth / aspectRatio;
					}else{
						resultHeight = ris.h;
						resultWidth = resultHeight * aspectRatio;
					}

					tempCanvas.width = resultWidth;
					tempCanvas.height = resultHeight;

					tempCtx.drawImage(image,
						x,
						y,
						areaWidth,
						areaHeight,
						0,
						0,
						Math.round(resultWidth),
						Math.round(resultHeight));
				}
			}
			return tempCanvas;
		};

		const renderImageToDataURL = function(getResultImageSize){
			const retObj = {
				dataURI: null,
				imageData: null
			};
			const tempCanvas = renderTempCanvas(getResultImageSize, theArea.getCenterPoint());
			if(image !== null){
				if(resImgQuality !== null){
					retObj.dataURI = tempCanvas.toDataURL(resImgFormat, resImgQuality);
				}else{
					retObj.dataURI = tempCanvas.toDataURL(resImgFormat);
				}
			}
			return retObj;
		};

		this.getResultImage = function(){
			if(resImgSizeArray.length === 0){
				return renderImageToDataURL(this.getResultImageSize());
			}

			const arrayResultImages = [];
			for(let i = 0; i < resImgSizeArray.length; i++){
				arrayResultImages.push({
					dataURI: renderImageToDataURL(resImgSizeArray[i]).dataURI,
					w: resImgSizeArray[i].w,
					h: resImgSizeArray[i].h
				});
			}

			return arrayResultImages;
		};

		this.getResultImageDataBlob = function(){
			const _p = $q.defer();
			const tempCanvas = renderTempCanvas(this.getResultImageSize(), theArea.getCenterPoint());
			if(resImgQuality !== null){
				tempCanvas.toBlob(function(blob){
					_p.resolve(blob);
				}, resImgFormat, resImgQuality);
			}else{
				tempCanvas.toBlob(function(blob){
					_p.resolve(blob);
				}, resImgFormat);
			}

			return _p.promise;
		};

		this.getAreaCoords = function(){
			return theArea.getSize();
		};

		this.getArea = function(){
			return theArea;
		};

		this.setNewImageSource = function(imageSource){
			image = null;
			resetCropHost();
			if(imageSource){
				const newImage = new Image();
				newImage.onload = function(){
					events.trigger(`load-done`);

					cropEXIF.getData(newImage, function(){
						const orientation = cropEXIF.getTag(newImage, `Orientation`);

						if([3, 6, 8].indexOf(orientation) > -1){
							const canvas = document.createElement(`canvas`);
							const ctx = canvas.getContext(`2d`);
							let cw = newImage.width;
							let ch = newImage.height;
							let cx = 0;
							let cy = 0;
							let deg = 0;
							let rw = 0;
							let rh = 0;
							rw = cw;
							rh = ch;
							switch(orientation){
								case 3:
									cx = -newImage.width;
									cy = -newImage.height;
									deg = 180;
									break;
								case 6:
									cw = newImage.height;
									ch = newImage.width;
									cy = -newImage.height;
									rw = ch;
									rh = cw;
									deg = 90;
									break;
								case 8:
									cw = newImage.height;
									ch = newImage.width;
									cx = -newImage.width;
									rw = ch;
									rh = cw;
									deg = 270;
									break;
							}

							//// canvas.toDataURL will only work if the canvas isn't too large. Resize to 1000px.
							const maxWorH = 1000;
							if(cw > maxWorH || ch > maxWorH){
								let p = 0;
								if(cw > maxWorH){
									p = maxWorH / cw;
									cw = maxWorH;
									ch = p * ch;
								}else if(ch > maxWorH){
									p = maxWorH / ch;
									ch = maxWorH;
									cw = p * cw;
								}

								cy = p * cy;
								cx = p * cx;
								rw = p * rw;
								rh = p * rh;
							}

							canvas.width = cw;
							canvas.height = ch;
							ctx.rotate(deg * Math.PI / 180);
							ctx.drawImage(newImage, cx, cy, rw, rh);

							image = new Image();
							image.onload = function(){
								resetCropHost();
								events.trigger(`image-updated`);
							};

							image.src = canvas.toDataURL(resImgFormat);
						}else{
							image = newImage;
							events.trigger(`image-updated`);
						}
						resetCropHost();
					});
				};
				newImage.onerror = function(){
					events.trigger(`load-error`);
				};
				events.trigger(`load-start`);
				if(imageSource instanceof window.Blob){
					newImage.src = URL.createObjectURL(imageSource);
				}else{
					if(imageSource.substring(0, 4).toLowerCase() === `http` || imageSource.substring(0, 2) === `//`){
						newImage.crossOrigin = `anonymous`;
					}
					newImage.src = imageSource;
				}
			}
		};

		this.setMaxDimensions = function(width, height){
			maxCanvasDims = [width, height];

			if(image !== null){
				const curWidth = ctx.canvas.width;
				const curHeight = ctx.canvas.height;

				const imageDims = [image.width, image.height];
				const imageRatio = image.width / image.height;
				const canvasDims = imageDims;

				if(canvasDims[0] > maxCanvasDims[0]){
					canvasDims[0] = maxCanvasDims[0];
					canvasDims[1] = canvasDims[0] / imageRatio;
				}else if(canvasDims[0] < minCanvasDims[0]){
					canvasDims[0] = minCanvasDims[0];
					canvasDims[1] = canvasDims[0] / imageRatio;
				}
				if(scalemode === `fixed-height` && canvasDims[1] > maxCanvasDims[1]){
					canvasDims[1] = maxCanvasDims[1];
					canvasDims[0] = canvasDims[1] * imageRatio;
				}else if(canvasDims[1] < minCanvasDims[1]){
					canvasDims[1] = minCanvasDims[1];
					canvasDims[0] = canvasDims[1] * imageRatio;
				}
				elCanvas.prop(`width`, canvasDims[0]).prop(`height`, canvasDims[1]);

				if(scalemode === `fixed-height`){
					elCanvas.css({
						'margin-left': - (canvasDims[0] / 2) + `px`,
						'margin-top': - (canvasDims[1] / 2) + `px`
					});
				}

				const ratioNewCurWidth = ctx.canvas.width / curWidth;
				const ratioNewCurHeight = ctx.canvas.height / curHeight;
				const ratioMin = Math.min(ratioNewCurWidth, ratioNewCurHeight);

				//TODO: use top left corner point
				const center = theArea.getCenterPoint();
				theArea.setSize({
					w: theArea.getSize().w * ratioMin,
					h: theArea.getSize().h * ratioMin
				});
				theArea.setCenterPoint({
					x: center.x * ratioNewCurWidth,
					y: center.y * ratioNewCurHeight
				});
			}else{
				elCanvas.prop(`width`, 0).prop(`height`, 0).css({
					'margin-top': 0
				});
			}

			drawScene();
		};

		this.setAreaMinSize = function(size){
			if(angular.isUndefined(size)){
				return;
			}else if(typeof size === `number` || typeof size === `string`){
				size = {
					w: parseInt(parseInt(size), 10),
					h: parseInt(parseInt(size), 10)
				};
			}else{
				size = {
					w: parseInt(size.w, 10),
					h: parseInt(size.h, 10)
				};
			}
			if(!isNaN(size.w) && !isNaN(size.h)){
				theArea.setMinSize(size);
				drawScene();
			}
		};

		this.setAreaMinRelativeSize = function(size){
			if(image === null || angular.isUndefined(size)){
				return;
			}

			const canvasSize = theArea.getCanvasSize();

			if(typeof size === `number` || typeof size === `string`){
				areaMinRelativeSize = {
					w: size,
					h: size
				};
				size = {
					w: canvasSize.w / (image.width / parseInt(parseInt(size), 10)),
					h: canvasSize.h / (image.height / parseInt(parseInt(size), 10))
				};
			}else{
				areaMinRelativeSize = size;
				size = {
					w: canvasSize.w / (image.width / parseInt(parseInt(size.w), 10)),
					h: canvasSize.h / (image.height / parseInt(parseInt(size.h), 10))
				};
			}

			if(!isNaN(size.w) && !isNaN(size.h)){
				theArea.setMinSize(size);
				drawScene();
			}
		};

		this.setAreaInitSize = function(size){
			if(angular.isUndefined(size)){
				return;
			}else if(typeof size === `number` || typeof size === `string`){
				size = {
					w: parseInt(parseInt(size), 10),
					h: parseInt(parseInt(size), 10)
				};
			}else{
				size = {
					w: parseInt(size.w, 10),
					h: parseInt(size.h, 10)
				};
			}
			if(!isNaN(size.w) && !isNaN(size.h)){
				theArea.setInitSize(size);
				drawScene();
			}
		};

		this.setAreaInitCoords = function(coords){
			if(angular.isUndefined(coords)){
				return;
			}else{
				coords = {
					x: parseInt(coords.x, 10),
					y: parseInt(coords.y, 10)
				};
			}
			if(!isNaN(coords.x) && !isNaN(coords.y)){
				theArea.setInitCoords(coords);
				drawScene();
			}
		};

		this.setMaxCanvasDimensions = function(maxCanvasDimensions){
			if(!angular.isUndefined(maxCanvasDimensions)){
				let newMaxCanvasDims = [];
				if(typeof maxCanvasDimensions === `number` || typeof maxCanvasDimensions === `string`){
					newMaxCanvasDims = [
						parseInt(parseInt(maxCanvasDimensions), 10),
						parseInt(parseInt(maxCanvasDimensions), 10)
					];
				}else{
					newMaxCanvasDims = [
						parseInt(maxCanvasDimensions.w, 10),
						parseInt(maxCanvasDimensions.h, 10)
					];
				}
				if((!isNaN(newMaxCanvasDims[0]) &&
					newMaxCanvasDims[0] > 0 &&
					newMaxCanvasDims[0] > minCanvasDims[0]) &&
					(!isNaN(newMaxCanvasDims[1]) &&
					newMaxCanvasDims[1] > 0 &&
					newMaxCanvasDims[1] > minCanvasDims[1])){
					maxCanvasDims = newMaxCanvasDims;
				}
			}
		};

		this.setMinCanvasDimensions = function(minCanvasDimensions){
			if(!angular.isUndefined(minCanvasDimensions)){
				let newMinCanvasDims = [];
				if(typeof minCanvasDimensions === `number` || typeof minCanvasDimensions === `string`){
					newMinCanvasDims = [
						parseInt(parseInt(minCanvasDimensions), 10),
						parseInt(parseInt(minCanvasDimensions), 10)
					];
				}else{
					newMinCanvasDims = [
						parseInt(minCanvasDimensions.w, 10),
						parseInt(minCanvasDimensions.h, 10)
					];
				}
				if((!isNaN(newMinCanvasDims[0]) &&
					newMinCanvasDims[0] >= 0) &&
					(!isNaN(newMinCanvasDims[1]) &&
					newMinCanvasDims[1] >= 0)){
					minCanvasDims = newMinCanvasDims;
				}
			}
		};

		this.setScalemode = function(value){
			scalemode = value;
		};

		this.getScalemode = function(){
			return scalemode;
		};

		this.getResultImageSize = function(){
			if(resImgSize === `selection`){
				return theArea.getSize();
			}

			if(resImgSize === `max`){
				// We maximize the rendered size
				let zoom = 1;
				if(image && ctx && ctx.canvas){
					zoom = image.width / ctx.canvas.width;
				}
				const size = {
					w: zoom * theArea.getSize().w,
					h: zoom * theArea.getSize().h
				};

				if(areaMinRelativeSize){
					if(size.w < areaMinRelativeSize.w){
						size.w = areaMinRelativeSize.w;
					}
					if(size.h < areaMinRelativeSize.h){
						size.h = areaMinRelativeSize.h;
					}
				}

				return size;
			}

			return resImgSize;
		};

		this.setResultImageSize = function(size){
			if(angular.isArray(size)){
				resImgSizeArray = size.slice();
				size = {
					w: parseInt(size[0].w, 10),
					h: parseInt(size[0].h, 10)
				};
				return;
			}
			if(angular.isUndefined(size)){
				return;
			}
			//allow setting of size to "selection" for mirroring selection's dimensions
			if(angular.isString(size)){
				resImgSize = size;
				return;
			}
			//allow scalar values for square-like selection shapes
			if(angular.isNumber(size)){
				size = parseInt(size, 10);
				size = {
					w: size,
					h: size
				};
			}
			size = {
				w: parseInt(size.w, 10),
				h: parseInt(size.h, 10)
			};
			if(!isNaN(size.w) && !isNaN(size.h)){
				resImgSize = size;
				drawScene();
			}
		};

		this.setResultImageFormat = function(format){
			resImgFormat = format;
		};

		this.setResultImageQuality = function(quality){
			quality = parseFloat(quality);
			if(!isNaN(quality) && quality >= 0 && quality <= 1){
				resImgQuality = quality;
			}
		};

		// returns a string of the selection area's type
		this.getAreaType = function(){
			return theArea.getType();
		};

		this.setAreaType = function(type){
			const center = theArea.getCenterPoint();
			const curSize = theArea.getSize();
			const curMinSize = theArea.getMinSize();
			const curX = center.x;
			const curY = center.y;

			let AreaClass = CropAreaCircle;
			if(type === `square`){
				AreaClass = CropAreaSquare;
			}else if(type === `rectangle`){
				AreaClass = CropAreaRectangle;
			}
			theArea = new AreaClass(ctx, events);
			theArea.setMinSize(curMinSize);
			theArea.setSize(curSize);
			if(type === `square` || type === `circle`){
				forceAspectRatio = true;
				theArea.setForceAspectRatio(true);
			}else{
				forceAspectRatio = false;
				theArea.setForceAspectRatio(false);
			}

			//TODO: use top left point
			theArea.setCenterPoint({
				x: curX,
				y: curY
			});

			// resetCropHost();
			if(image !== null){
				theArea.setImage(image);
			}

			drawScene();
		};

		this.getDominantColor = function(uri){
			const imageDC = new Image();
			const colorThief = new ColorThief();
			let dominantColor = null;
			const _p = $q.defer();
			imageDC.src = uri;
			imageDC.onload = function(){
				dominantColor = colorThief.getColor(imageDC);
				_p.resolve(dominantColor);
			};

			return _p.promise;
		};

		this.getPalette = function(uri){
			const imageDC = new Image();
			const colorThief = new ColorThief();
			let palette = null;
			const _p = $q.defer();
			imageDC.src = uri;
			imageDC.onload = function(){
				palette = colorThief.getPalette(imageDC, colorPaletteLength);
				_p.resolve(palette);
			};

			return _p.promise;
		};

		this.setPaletteColorLength = function(lg){
			colorPaletteLength = lg;
		};

		this.setAspect = function(aspect){
			isAspectRatio = true;
			theArea.setAspect(aspect);
			const minSize = theArea.getMinSize();
			minSize.w = minSize.h * aspect;
			theArea.setMinSize(minSize);
			const size = theArea.getSize();
			size.w = size.h * aspect;
			theArea.setSize(size);
		};

		/* Life Cycle begins */

		// Init Context var
		ctx = elCanvas[0].getContext(`2d`);

		// Init CropArea
		theArea = new CropAreaCircle(ctx, events);

		// Init Mouse Event Listeners
		$document.on(`mousemove`, onMouseMove);
		elCanvas.on(`mousedown`, onMouseDown);
		$document.on(`mouseup`, onMouseUp);

		// Init Touch Event Listeners
		$document.on(`touchmove`, onMouseMove);
		elCanvas.on(`touchstart`, onMouseDown);
		$document.on(`touchend`, onMouseUp);

		// CropHost Destructor
		this.destroy = function(){
			$document.off(`mousemove`, onMouseMove);
			elCanvas.off(`mousedown`, onMouseDown);
			$document.off(`mouseup`, onMouseUp);

			$document.off(`touchmove`, onMouseMove);
			elCanvas.off(`touchstart`, onMouseDown);
			$document.off(`touchend`, onMouseUp);

			elCanvas.remove();
		};
	};
}

module.exports = cropHost;