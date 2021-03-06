//d3.svg.worldMap


import Class from '../base/class'

export default Class.extend({

  init: function(context, conditions) {
    this.context = context;
    this.width = 0;
    this.height = 0;
    this.topOffset = 0;
    this.leftOffset = 0;
    this.bottomOffset = 0;
    this.rifgtOffset = 0;
    this.fontSize = 0;
    this.fontWidth = 0;
    this.fontHeight = 0;
    this.xAlign = 'center';
    this.yAlign = 'center';
    this.symbols = [];
    if (conditions) {
      this.setConditions(conditions);
    }
  },

  setConditions: function(conditions) {
    if (conditions.rightOffset && !isNaN(parseFloat(conditions.rightOffset)) && isFinite(conditions.rightOffset)) {
      this.rifgtOffset = conditions.rightOffset;
    }
    if (conditions.leftOffset && !isNaN(parseFloat(conditions.leftOffset)) && isFinite(conditions.leftOffset)) {
      this.leftOffset = conditions.leftOffset;
    }
    if (conditions.topOffset && !isNaN(parseFloat(conditions.topOffset)) && isFinite(conditions.topOffset)) {
      this.topOffset = conditions.topOffset;
    }
    if (conditions.bottomOffset && !isNaN(parseFloat(conditions.bottomOffset)) && isFinite(conditions.bottomOffset)) {
      this.bottomOffset = conditions.bottomOffset;
    }
    if (conditions.xAlign) {
      this.xAlign = conditions.xAlign;
    }
    if (conditions.yAlign) {
      this.yAlign = conditions.yAlign;
    }
    return this;
  },

  resize: function(width, height, fontSize, topOffset, leftOffset) {
    this.width = width;
    this.height = height;
    this.fontSize = fontSize;
    if (topOffset) {
      this.topOffset = topOffset;
    }
    if (leftOffset) {
      this.leftOffset = leftOffset;
    }

    var sample = this.context.append("text").text("0").style("font-size", this.fontSize + "px");
    this.fontWidth = sample[0][0].getBBox().width;
    this.fontHeight = this.fontSize*0.72;

    d3.select(sample[0][0]).remove();
    this.__resizeText();
  },

  setText: function(text, resize) {
    var _this = this;
    var newSymbols = text.split('');
    if (newSymbols.length != this.symbols.length) {
      resize = true;
    }
    this.symbols = text.split('');

    this.context.selectAll("text")
      .data(this.symbols).exit().remove();
    this.context.selectAll("text")
      .data(this.symbols)
      .enter()
      .append("text")
      .text(function(d){return d;});

    this.context.selectAll("text").each(function (d, i) {
        d3.select(this).text(d);
    });
    if (resize) {
      return this.__resizeText();
    } else {
      return this;
    }

  },

  __resizeText: function() {
    var _this = this;
    this.context.attr("transform", "translate(" + this.__getLeftOffset() + "," + this.__getTopOffset() + ")");
    this.context.selectAll("text").each(function(d, i) {
        d3.select(this)
          .attr("x", _this.fontWidth * i)
          .style("font-size", _this.fontSize + 'px')
          .style("text-anchor", "middle");
      });
    return this;
  },
  __getLeftOffset: function() {
    switch (this.xAlign) {
      case 'right':
        return this.width - this.fontWidth * this.symbols.length + this.fontWidth/2;
        break;
      case 'left':
        return this.fontWidth/2;
        break;
      default :
        return this.fontWidth/2 + (this.width - this.fontWidth * this.symbols.length)/2;
    }
  },
  __getTopOffset: function() {
    //console.log(this.topOffset);
    switch (this.yAlign) {
      case 'top':
        return this.fontHeight + this.topOffset;
        break;
      case 'bottom':
        return this.height - this.bottomOffset;
        break;
      default :
        return this.fontHeight + (this.height - this.fontHeight)/2 + this.topOffset;
    }
  }

});
