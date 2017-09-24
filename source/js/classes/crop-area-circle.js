cropAreaCircle.$inject = [`cropArea`];
function cropAreaCircle(CropArea){
	const CropAreaCircle = function(){
		CropArea.apply(this, arguments);

		this._boxResizeBaseSize = 25;
		this._boxResizeNormalRatio = 1;
		this._boxResizeHoverRatio = 1.2;
		this._iconMoveNormalRatio = 0.9;
		this._iconMoveHoverRatio = 1.2;

		this._boxResizeNormalSize = this._boxResizeBaseSize * this._boxResizeNormalRatio;
		this._boxResizeHoverSize = this._boxResizeBaseSize * this._boxResizeHoverRatio;

		this._posDragStartX = 0;
		this._posDragStartY = 0;
		this._posResizeStartX = 0;
		this._posResizeStartY = 0;
		this._posResizeStartSize = 0;

		this._boxResizeIsHover = false;
		this._areaIsHover = false;
		this._boxResizeIsDragging = false;
		this._areaIsDragging = false;
	};

	CropAreaCircle.prototype = new CropArea();

	CropAreaCircle.prototype.getType = function(){
		return `circle`;
	};

	CropAreaCircle.prototype._calcCirclePerimeterCoords = function(angleDegrees){
		const hSize = this._size.w / 2;
		const angleRadians = angleDegrees * (Math.PI / 180);
		const circlePerimeterX = this.getCenterPoint().x + (hSize * Math.cos(angleRadians));
		const circlePerimeterY = this.getCenterPoint().y + (hSize * Math.sin(angleRadians));
		return [circlePerimeterX, circlePerimeterY];
	};

	CropAreaCircle.prototype._calcResizeIconCenterCoords = function(){
		return this._calcCirclePerimeterCoords(-45);
	};

	CropAreaCircle.prototype._isCoordWithinArea = function(coord){
		return Math.sqrt(
			((coord[0] - this.getCenterPoint().x) * (coord[0] - this.getCenterPoint().x)) +
			((coord[1] - this.getCenterPoint().y) * (coord[1] - this.getCenterPoint().y))
		) < this._size.w / 2;
	};
	CropAreaCircle.prototype._isCoordWithinBoxResize = function(coord){
		const resizeIconCenterCoords = this._calcResizeIconCenterCoords();
		const hSize = this._boxResizeHoverSize / 2;
		return coord[0] > resizeIconCenterCoords[0] - hSize && coord[0] < resizeIconCenterCoords[0] + hSize &&
			coord[1] > resizeIconCenterCoords[1] - hSize && coord[1] < resizeIconCenterCoords[1] + hSize;
	};

	CropAreaCircle.prototype._drawArea = function(ctx, centerCoords, size){
		ctx.arc(centerCoords.x, centerCoords.y, size.w / 2, 0, 2 * Math.PI);
	};

	CropAreaCircle.prototype.draw = function(){
		CropArea.prototype.draw.apply(this, arguments);

		// draw move icon
		const center = this.getCenterPoint();
		this._cropCanvas.drawIconMove([center.x, center.y], this._areaIsHover ? this._iconMoveHoverRatio : this._iconMoveNormalRatio);

		// draw resize cubes
		this._cropCanvas.drawIconResizeBoxNESW(this._calcResizeIconCenterCoords(), this._boxResizeBaseSize, this._boxResizeIsHover ? this._boxResizeHoverRatio : this._boxResizeNormalRatio);
	};

	CropAreaCircle.prototype.processMouseMove = function(mouseCurX, mouseCurY){
		let cursor = `default`;
		let res = false;

		this._boxResizeIsHover = false;
		this._areaIsHover = false;

		if(this._areaIsDragging){
			this.setCenterPointOnMove({
				x: mouseCurX - this._posDragStartX,
				y: mouseCurY - this._posDragStartY
			});
			this._areaIsHover = true;
			cursor = `move`;
			res = true;
			this._events.trigger(`area-move`);
		}else if(this._boxResizeIsDragging){
			cursor = `nesw-resize`;
			let iFR;
			const iFX = mouseCurX - this._posResizeStartX;
			const iFY = this._posResizeStartY - mouseCurY;
			if(iFX > iFY){
				iFR = this._posResizeStartSize.w + (iFY * 2);
			}else{
				iFR = this._posResizeStartSize.w + (iFX * 2);
			}

			const newNO = {};
			const newSE = {};

			const iFRHalf = iFR * 0.5;
			newNO.x = this.getCenterPoint().x - iFRHalf;
			newSE.x = this.getCenterPoint().x + iFRHalf;

			newNO.y = this.getCenterPoint().y - iFRHalf;
			newSE.y = this.getCenterPoint().y + iFRHalf;

			this.circleOnMove(newNO, newSE);
			this._boxResizeIsHover = true;
			res = true;
			this._events.trigger(`area-resize`);
		}else if(this._isCoordWithinBoxResize([mouseCurX, mouseCurY])){
			cursor = `nesw-resize`;
			this._areaIsHover = false;
			this._boxResizeIsHover = true;
			res = true;
		}else if(this._isCoordWithinArea([mouseCurX, mouseCurY])){
			cursor = `move`;
			this._areaIsHover = true;
			res = true;
		}

		//this._dontDragOutside();
		angular.element(this._ctx.canvas).css({
			cursor
		});

		return res;
	};

	CropAreaCircle.prototype.processMouseDown = function(mouseDownX, mouseDownY){
		if(this._isCoordWithinBoxResize([mouseDownX, mouseDownY])){
			this._areaIsDragging = false;
			this._areaIsHover = false;
			this._boxResizeIsDragging = true;
			this._boxResizeIsHover = true;
			this._posResizeStartX = mouseDownX;
			this._posResizeStartY = mouseDownY;
			this._posResizeStartSize = this._size;
			this._events.trigger(`area-resize-start`);
		}else if(this._isCoordWithinArea([mouseDownX, mouseDownY])){
			this._areaIsDragging = true;
			this._areaIsHover = true;
			this._boxResizeIsDragging = false;
			this._boxResizeIsHover = false;
			const center = this.getCenterPoint();
			this._posDragStartX = mouseDownX - center.x;
			this._posDragStartY = mouseDownY - center.y;
			this._events.trigger(`area-move-start`);
		}
	};

	CropAreaCircle.prototype.processMouseUp = function(/*mouseUpX, mouseUpY*/){
		if(this._areaIsDragging){
			this._areaIsDragging = false;
			this._events.trigger(`area-move-end`);
		}
		if(this._boxResizeIsDragging){
			this._boxResizeIsDragging = false;
			this._events.trigger(`area-resize-end`);
		}
		this._areaIsHover = false;
		this._boxResizeIsHover = false;

		this._posDragStartX = 0;
		this._posDragStartY = 0;
	};

	return CropAreaCircle;
}

module.exports = cropAreaCircle;