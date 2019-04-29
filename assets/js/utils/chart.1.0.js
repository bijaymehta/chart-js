(function () {
    "use strict";

    //http://stackoverflow.com/questions/4576724/dotted-stroke-in-canvas#answer-4663129
    var CP = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
    if (CP.lineTo) {
        CP.dashedLine = function (x, y, x2, y2, da) {
            if (!da)
                da = [10, 5];
            this.save();
            this.beginPath();
            var dx = (x2 - x),
            dy = (y2 - y);
            var len = Math.sqrt(dx * dx + dy * dy);
            var rot = Math.atan2(dy, dx);
            this.translate(x, y);
            this.moveTo(0, 0);
            this.rotate(rot);
            var dc = da.length;
            var di = 0,
            draw = true;
            x = 0;
            while (len > x) {
                x += da[di++ % dc];
                if (x > len)
                    x = len;
                draw ? this.lineTo(x, 0) : this.moveTo(x, 0);
                draw = !draw;
            }
            this.restore();
        }
    }
    if (CP.fillText) {
        CP.addText = function (options) {
            var settings = extend(this.addText.options, options);
            if (settings.textAlign)
                this.textAlign = settings.textAlign;
            if (settings.color)
                this.fillStyle = settings.color;
            if (settings.font)
                this.font = settings.font;
            this.fillText(settings.text, settings.x, settings.y);
        }
        CP.addText.options = {
            x : 0,
            y : 0,
            text : ""
        }
    }

    function isArray(obj) {
        return Object.prototype.toString.apply(obj) == "[object Array]"
    }
    function isObject(obj) {
        return Object.prototype.toString.apply(obj) == "[object Object]"
    }
    function extend(obj1, obj2) {
        obj1 = obj1 || {};
        obj2 = obj2 || {};
        var new_obj = {};
        if (isObject(obj1)) {
            for (var i in obj1) {
                new_obj[i] = obj1[i];
            }
        }
        if (isObject(obj2)) {
            for (var i in obj2) {
                new_obj[i] = obj2[i];
            }
        }
        return new_obj;
    }
    function mergeChartConfig(defaults, userDefined) {
        var returnObj = {};
        for (var attrname in defaults) {
            returnObj[attrname] = defaults[attrname];
        }
        for (var attrname in userDefined) {
            returnObj[attrname] = userDefined[attrname];
        }
        return returnObj;
    }
    function verifyData(data) {
        var format = "\n{\n   label: [],\n   data: []\n}\n";
        if (!isObject(data)) {
            console.log("data missing: expecting format:" + format);
            return false;
        }
        if (!data.labels) {
            console.log("labels missing: expecting format:" + format);
            return false
        }
        if (!data.data || !isArray(data.data)) {
            console.log("data missing: expecting format:" + format);
            return false
        }
        var l = data.data.length;
        for (var i = 0; i < l; i++) {
            if (data.labels.length != data.data[i].consumption.length) {
                console.log("data and labels mismatch");
                return false;
            }
        }
        return true
    }

    function drawBalloon(balloon, X, Y, consumption, temperature) {
        var context = balloon.getContext('2d');
        context.canvas.width = context.canvas.width;
        context.save();
        context.fillStyle = "#FFFFFF";
        context.strokeStyle = "#E9E8EF";
        context.beginPath();
        var d = 7;
        var W = context.canvas.width; //105;
        var H = context.canvas.height; //55;
        var cH = 20; //arrow width
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(d, d);
        context.lineTo(W - d, d);
        context.lineTo(W - d, H - (cH / 2 + d));
        context.lineTo((W - cH) / 2, H - (cH / 2 + d));
        context.lineTo(W / 2, H - d);
        context.lineTo((W + cH) / 2, H - (cH / 2 + d));
        context.lineTo(d, H - (cH / 2 + d));
        context.lineTo(d, d);
        context.shadowColor = 'rgba(0,0,0,0.2)';
        context.shadowBlur = 7;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;
        context.stroke();
        context.fill();
        context.font = "12pt arial";
        context.fillStyle = "black";
        context.textAlign = "center";
        context.fillText(consumption, W / 2, 20 + d);
        context.fillText(temperature, W / 2, 45 + d);
        context.restore();
        balloon.style.left = X + "px";
        balloon.style.top = Y - 70 + "px";
    }

    var chartCollection = [];

    window.Chart = function (options) {
        var self = this;
        self.rotated = false;
        self.options = extend(self.defaults, options);

        var plot = self.options.plot;
        if (!verifyData(plot)) {
            return;
        }
        var canvas = document.getElementById(self.options.canvasID);
        var context = canvas.getContext('2d');

        var balloon = document.getElementById(self.options.balloonID);
        var popCtx = balloon.getContext("2d");
        
        self.width = context.canvas.width;
        self.height = context.canvas.height;

        var chartWidth = context.canvas.width - self.options.chart.marginLeft - self.options.chart.marginRight;
        var chartHeight = context.canvas.height - self.options.chart.marginTop - self.options.chart.marginBottom;
        var startX = 0 + self.options.chart.marginLeft;
        var startY = 0 + self.options.chart.marginTop;
        var stageConsumption = [];

        var l = plot.data.length;
        var min = null;
        var max = 0;
        var records;
        var barWidth;

        for (var i = 0; i < l; i++) {
            records = plot.data[i].consumption.length;
            if (records > 0) {
                min = Math.min.apply(min, [Math.min.apply(null, plot.data[i].consumption)]);
                max = Math.max(max, Math.max.apply(null, plot.data[i].consumption));
            }
        }
        max = Math.round(max * self.options.axes.yMax);
        barWidth = Math.floor((chartWidth - (records + 1) * self.options.bar.margin - records * self.options.bar.marginCompare) / (records * l));
        var consumptionScreenRatio = chartHeight / max; //????


        function onClickCanvas(e) {
            var clientY = e.y ? e.y : e.layerY; //firefox bug, it is not returning correct clientY
            var clientX = e.x ? e.x : e.layerX; //firefox bug, it is not returning correct clientY
            var ratio = canvas.scrollWidth / canvas.width;
            var mouseX = Math.round(parseInt(clientX - canvas.offsetLeft) / ratio);
            var mouseY = Math.round(parseInt(clientY - canvas.offsetTop) / ratio);
            var l = stageConsumption.length;
            var hideBalloon = true;
            var A = self.rotated ? -90 : 0;
            var CosA = Math.round(Math.cos(A * Math.PI / 180) * 100) / 100;
            var SinA = Math.round(Math.sin(A * Math.PI / 180) * 100) / 100;
            var translateX = 0;
            var translateY = self.rotated ? self.height : 0;
            var _mouseX = translateX + mouseX * CosA - mouseY * SinA;
            var _mouseY = translateY + mouseX * SinA + mouseY * CosA;

            for (var i = 0; i < l; i++) {
                if (_mouseX >= stageConsumption[i].x1
                     && _mouseX <= stageConsumption[i].x2
                     && _mouseY >= stageConsumption[i].y1
                     && _mouseY <= stageConsumption[i].y2) {
                    hideBalloon = false;
                    var _x = self.rotated ? clientX : Math.round(canvas.offsetLeft + (stageConsumption[i].x1 + stageConsumption[i].width / 2) * ratio - popCtx.canvas.width / 2);
                    var _y = self.rotated ? clientY : Math.round(canvas.offsetTop + stageConsumption[i].y1 * ratio);
                    drawBalloon(balloon, _x, _y, stageConsumption[i].consumption + " " + self.options.plot.units.consumption, stageConsumption[i].temperature + " " + self.options.plot.units.temperature)
                }
            }

            if (hideBalloon)
                balloon.style.left = "-200px";
        }
        if (window.addEventListener) {
            canvas.addEventListener('click', onClickCanvas);
        } else {
            canvas.attachEvent('onclick', onClickCanvas);
        }

        function drawXAxis(min, max, steps, translateY) {

            var stepper = Math.ceil(max / steps);
            stepper = Math.round(stepper / 10) * 10;
            context.font = self.options.axes.yFont;
            context.strokeStyle = "rgba(0,0,0,0.2)";
            context.fillStyle = self.options.labelColor;
            context.textAlign = "right";
            for (var i = 0; i < steps; i++) {
                var y = Math.round(chartHeight - i * stepper * translateY);
                if (y < self.options.chart.marginTop) {
                    break;
                }
                context.moveTo(self.options.chart.marginLeft, y);
                context.lineTo(chartWidth + self.options.chart.marginLeft, y);
                context.fillText(i * stepper, self.options.chart.marginLeft - 1, y + 5);
            }
            context.stroke();
        }

        function plotBars() {
            context.font = self.options.font;
            context.textAlign = "left";
            for (var i = 0; i < l; i++) {
                context.fillStyle = plot.data[i].color || "rgba(128,128,128, 0.5)";
                context.strokeStyle = plot.data[i].outline || plot.data[i].color || "rgba(128,128,128, 1)";
                for (var j = 0; j < plot.data[i].consumption.length; j++) {
                    var height = plot.data[i].consumption[j] * consumptionScreenRatio;
                    var x = Math.round(self.options.chart.marginLeft + (i + j) * self.options.bar.marginCompare + (j * l + i) * barWidth + (j + 1) * self.options.bar.margin);
                    var y = Math.round(chartHeight + self.options.chart.marginTop - height);
                    context.fillRect(x, y, barWidth, height);
                    context.strokeRect(x, y, barWidth, height);
                    if (self.options.bar.label)
                        context.fillText(plot.data[i].consumption[j], x, y - 5);
                    stageConsumption.push({
                        x : x,
                        y : y,
                        x1 : x,
                        x2 : x + barWidth,
                        y1 : y,
                        y2 : y + height,
                        width : barWidth,
                        height : height,
                        consumption : plot.data[i].consumption[j],
                        temperature : plot.data[i].temperature[j],
                        group : i
                    });
                }
            }

            context.textAlign = "center";
            context.font = self.options.axes.xFont;
            context.fillStyle = self.options.labelColor;
            for (var i = 0; i < plot.labels.length; i++) {
                var x = self.options.chart.marginLeft + self.options.bar.margin + i * (self.options.bar.margin + self.options.bar.marginCompare) + l * i * barWidth + (l * barWidth + (l - 1) * self.options.bar.marginCompare) / 2;
                var y = chartHeight + self.options.chart.marginTop + 20;
                context.fillText(plot.labels[i], x, y);
            }
        }

        /*
         * BLOCK
         * plot dashed line
         * white overlay
         */
        function drawBlockLevel() {
            var y = Math.round(chartHeight - self.options.plot.block * consumptionScreenRatio);
            context.strokeStyle = "#CF4520";
            context.dashedLine(self.options.chart.marginLeft, y, chartWidth + self.options.chart.marginLeft, y);
            context.stroke();
            context.fillStyle = "rgba(255,255,255,0.5)";
            context.fillRect(self.options.chart.marginLeft, y, chartWidth, Math.round(self.options.plot.block * consumptionScreenRatio));
            context.addText({
                x : self.options.chart.marginLeft - 1,
                y : y + 5,
                text : self.options.plot.block,
                color : "#CF4520",
                textAlign : "right"
            })
        }

        /*
         * draw temperature
         */
        function drawTemperaturePolygon() {
            var temperatureMax = 0;
            for (var i = 0; i < l; i++) {
                records = plot.data[i].temperature.length;
                if (records > 0) {
                    temperatureMax = Math.max(temperatureMax, Math.max.apply(null, plot.data[i].temperature));
                }
            }
            temperatureMax = Math.round(temperatureMax * self.options.axes.yMax);
            var temperatureScreenRatio = chartHeight / temperatureMax;
            for (var i = 0; i < stageConsumption.length; i++) {
                context.beginPath();
                var first = true;
                for (var j = 0; j < stageConsumption.length; j++) {
                    if (stageConsumption[j].group == i) {
                        var _y = Math.round(chartHeight + self.options.chart.marginLeft - stageConsumption[j].temperature * temperatureScreenRatio);
                        var _x = Math.round(stageConsumption[j].x + stageConsumption[j].width / 2);
                        if (first) {
                            context.moveTo(_x, _y);
                            first = false;
                        }
                        context.lineTo(_x, _y);
                        context.fillStyle = self.options.tempratureColors[i];
                        context.strokeStyle = self.options.tempratureColors[i];

                        context.fillRect(_x - 2, _y - 2, 4, 4);
                    }

                }

                context.stroke();

            }
        }

        function init() {
            drawXAxis(0, max, 10, consumptionScreenRatio);

            plotBars();

            if (self.options.plot.block > 0) {
                drawBlockLevel()
            }

            if (self.options.temperature == true) {
                drawTemperaturePolygon()
            }
        }

        self.rotate = function (rotate) {
            //context.save();
            self.rotated = rotate == true;
            if (rotate == true) {
                canvas.height = self.width;
                canvas.width = self.height;
                context.translate(self.height, 0);
                context.rotate(90 * Math.PI / 180);

            } else {
                canvas.height = self.height;
                canvas.width = self.width;
                context.translate(0, 0);
                context.rotate(0 * Math.PI / 180);
            }
            init();
            //context.restore();
        }

        chartCollection.push(this); //add to collection

        //init();

        if (window.innerWidth < 321) {
            this.rotate(true);
        }else{
            this.rotate(false);
        }

        return this;
    }
    window.Chart.prototype.defaults = {
        font : "20pt Helvetica",
        labelColor : "rgba(128,128,128, 1)",
        bar : {
            margin : 50,
            marginCompare : 10,
            label : false
        },
        chart : {
            //margin : 50,
            marginTop : 0,
            marginRight : 50,
            marginBottom : 30,
            marginLeft : 50
        },
        axes : {
            yMax : 1.15,
            xFont : "14pt Helvetica",
            yFont : "12pt Helvetica"
        },
        temperature : false,
        plot : {
            labels : [""],
            units : {
                consumption : "",
                temperature : ""
            },
            data : [{
                    color : "rgba(0,0,0,1)",
                    consumption : [0],
                    temperature : [0]
                }
            ],
            block : 0
        }
    }

    //make global responsive
    $window = $(window);
    $window.on('resize', function (e) {
        var chart;
        if (window.innerWidth < 321) {
            for (var i = 0; i < chartCollection.length; i++) {
                chartCollection[i].rotate(true);
            }
        } else {
            for (var i = 0; i < chartCollection.length; i++) {
                chartCollection[i].rotate(false);
            }
        }

    });

}());
