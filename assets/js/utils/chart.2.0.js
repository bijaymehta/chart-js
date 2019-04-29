(function () {
    "use strict";
    
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
                if(isObject(obj2[i])){
                    new_obj[i] = extend(new_obj[i], obj2[i])
                }else{
                    new_obj[i] = obj2[i];
                }
                
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
            if (data.labels.length != data.data[i].length) {
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
        context.font = "12pt sans-serif";
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

        var canvas = document.getElementById(self.options.canvasID);
        var context = canvas.getContext('2d');

        self.width = context.canvas.width;
        self.height = context.canvas.height;

        if (!verifyData(plot)) {
            context.fillStyle = "#F9F9F9";
            context.fillRect(0, 0, self.width, self.height);
            context.addText({
                x : self.width / 2,
                y : self.height / 2,
                text : "No graph available",
                textAlign : "center",
                color : "#CCCCCC",
                font : "30pt sans-serif"
            });
            return;

        }

        var balloon = document.getElementById(self.options.balloonID);
        var popCtx = balloon.getContext("2d");

        var l = plot.data.length;

        var stageConsumption = [];

        var min = 0;
        var max = 0;
        var maxThreshold = 0;
        var records;
        var barWidth;

        for (var i = 0; i < l; i++) {
            records = plot.labels.length;
            for (var j = 0; j < records; j++) {
                min = min < plot.data[i][j].consumption ? min : plot.data[i][j].consumption;
                max = max > plot.data[i][j].consumption ? max : plot.data[i][j].consumption;
                if (self.options.type == "electric") {
                    maxThreshold = maxThreshold > plot.data[i][j].threshold ? maxThreshold : plot.data[i][j].threshold;
                }
            }
        }
        max = Math.max(max, maxThreshold, 5);
        max = Math.round(max * self.options.axes.yMax * 10) / 10;

        //need space to rotate text
        var rotateLabelsX = false;

        var maxLabelsLengthX = 0;
        for (var i = 0; i < records; i++) {
            maxLabelsLengthX = Math.max(maxLabelsLengthX, plot.labels[i].length);
        }

        rotateLabelsX = (records > 6 && maxLabelsLengthX > 3) || (records > 12); //// ovais
        if (records > 6 && maxLabelsLengthX > 3 && self.options.chart.marginBottom < 70) {
            self.options.chart.marginBottom = 70;
        } else if (records > 12 && self.options.chart.marginBottom < 50) {
            self.options.chart.marginBottom = 30;
        }

        var chartWidth = context.canvas.width - self.options.chart.marginLeft - self.options.chart.marginRight;
        var chartHeight = context.canvas.height - self.options.chart.marginTop - self.options.chart.marginBottom;
        var startX = 0 + self.options.chart.marginLeft;
        var startY = 0 + self.options.chart.marginTop;

        barWidth = Math.floor((chartWidth - (records + 1) * self.options.bar.margin - records * self.options.bar.marginCompare) / (records * l));
        var maxBarWidth = Math.floor((chartWidth - (3 + 1) * self.options.bar.margin - 3 * self.options.bar.marginCompare) / (3 * l));
        barWidth = barWidth > maxBarWidth ? maxBarWidth : barWidth;

        var consumptionScreenRatio = chartHeight / max; //????


        function onClickCanvas(e) {
            //var clientY = e.y ? e.y : e.layerY; //firefox bug, it is not returning correct clientY
            //var clientX = e.x ? e.x : e.layerX; //firefox bug, it is not returning correct clientY
            var clientY = e.offsetY || e.layerY;
            var clientX = e.offsetX || e.layerX;

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
                    drawBalloon(
                        balloon,
                        _x,
                        _y,
                        stageConsumption[i].consumption + " " + self.options.units[self.options.type].consumption,
                        self.options.type == "gas" ? stageConsumption[i].temperature + " " + self.options.units[self.options.type].temperature : "")
                }
            }

            if (hideBalloon)
                balloon.style.left = "-20000px";
        }
        if (window.addEventListener) {
            canvas.addEventListener('click', onClickCanvas);
            canvas.addEventListener('mousemove', onClickCanvas);
        } else {
            canvas.attachEvent('onclick', onClickCanvas);
            canvas.attachEvent('onmousemove', onClickCanvas);
        }

        /*--------------------
        --------------------*/
        function drawXAxis(min, max, steps, translateY) {
            context.save();
            context.beginPath();
            var stepper = max / steps;
            var roundDecimal = max > 9 ? 1 : 100;
            if (Math.round(stepper) <= 1) {
                stepper = 1
            } else if (stepper < 5) {
                stepper = 5;
            } else {
                if(self.options.type == 'electric'){
                    stepper = Math.round(stepper / 100) * 100;
                }else{
                    stepper = Math.round(stepper / 10) * 10;
                }
            }

            context.font = self.options.axes.yFont;
            context.strokeStyle = self.options.axes.color;
            context.fillStyle = self.options.labelColor;

            for (var i = 0; i < steps * 2; i++) {
                var y = Math.round(chartHeight + self.options.chart.marginTop - i * stepper * translateY);

                if (y < self.options.chart.marginTop + 5) {
                    break;
                }

                context.moveTo(0, 0);
                context.moveTo(self.options.chart.marginLeft, y);
                context.lineTo(chartWidth + self.options.chart.marginLeft, y);
                context.textAlign = "right";
                context.fillText(Math.round(i * stepper * roundDecimal) / roundDecimal, self.options.chart.marginLeft - 1, y + 5);

            }
            context.stroke();
            context.restore();
        }

        function plotBars() {
            context.save();
            context.beginPath();
            context.font = self.options.font;
            context.textAlign = "left";
            stageConsumption = [];
            for (var i = 0; i < l; i++) {
                context.fillStyle = l == 1 ? self.options.colors.bar[self.options.type][1] : self.options.colors.bar[self.options.type][i] || "rgba(128,128,128, 1)";
                context.strokeStyle = l == 1 ? self.options.colors.bar[self.options.type][1] : self.options.colors.bar[self.options.type][i] || "rgba(128,128,128, 1)";
                for (var j = 0; j < plot.data[i].length; j++) {
                    var height = plot.data[i][j].consumption < 0 ? -0.1 : plot.data[i][j].consumption * consumptionScreenRatio;
                    var x = Math.round(self.options.chart.marginLeft + (i + j) * self.options.bar.marginCompare + (j * l + i) * barWidth + (j + 1) * self.options.bar.margin);
                    var y = Math.round(chartHeight + self.options.chart.marginTop - height);
                    context.fillRect(x, y, barWidth, height);
                    context.strokeRect(x, y, barWidth, height);
                    if (self.options.bar.label && plot.data[i].length < 7 && plot.data[i][j].consumption >= 0) {
                        context.save();
                        context.font = '10pt sans-serif';
                        context.fillText(plot.data[i][j].consumption, x, y - 5);
                        context.restore()
                    }
                    if (plot.data[i][j].threshold && plot.data[i][j].threshold > 0) {
                        context.save();
                        var color = l == 1 ? self.options.colors.block[self.options.type][1] : self.options.colors.block[self.options.type][i] || "rgba(255,255,255,0.5)";
                        drawBlocks(plot.data[i][j].consumption, plot.data[i][j].threshold, x, x + barWidth, color);
                        context.restore();
                    }
                    stageConsumption.push({
                        x : x,
                        y : y,
                        x1 : x,
                        x2 : x + barWidth,
                        y1 : y,
                        y2 : y + height,
                        width : barWidth,
                        height : height,
                        consumption : plot.data[i][j].consumption,
                        temperature : plot.data[i][j].temperature,
                        threshold : plot.data[i][j].threshold,
                        group : i
                    });
                }
            }

            context.textAlign = "center";
            context.font = self.options.axes.xFont;
            context.fillStyle = self.options.labelColor;

            for (var i = 0; i < plot.labels.length; i++) {
                context.save();
                var x = self.options.chart.marginLeft + self.options.bar.margin + i * (self.options.bar.margin + self.options.bar.marginCompare) + l * i * barWidth + (l * barWidth + (l - 1) * self.options.bar.marginCompare) / 2;
                var y = chartHeight + self.options.chart.marginTop + 20;

                if (rotateLabelsX) {
                    context.translate(x, y);
                    context.rotate(270 * Math.PI / 180);
                    
                    if (records > 6 && maxLabelsLengthX > 3) {
                        context.fillText(plot.labels[i], -15, 0);
                    } else {
                        context.fillText(plot.labels[i], 3, 0);
                    }
                } else {
                    context.fillText(plot.labels[i], x, y);
                }

                context.restore();
            }

            context.restore();
        }

        /*
         * BLOCK
         * plot dashed line

         */
        function drawBlocks(consumption, threshold, x1, x2, bgcolor) {
            if(consumption < 0) return;
            
            context.save();

            var _threshold = threshold > consumption ? consumption : threshold;
            
            var y = Math.round(chartHeight + self.options.chart.marginTop - _threshold * consumptionScreenRatio);
            context.fillStyle = bgcolor || "rgba(255,255,255,0.5)";
            context.fillRect(x1, y, x2 - x1, Math.round(_threshold * consumptionScreenRatio));

            context.strokeStyle = "#CF4520";
            context.lineWidth = 2;
            y = Math.round(chartHeight + self.options.chart.marginTop - threshold * consumptionScreenRatio);
            context.dashedLine(x1, y, x2, y, [5, 2]);
            context.stroke();

            context.restore();
        }

        /*
         * draw temperature
         */
        function drawTemperaturePolygon() {
            context.save();
            var temperatureMax = 0;
            var temperatureMin = 0;
            for (var i = 0; i < l; i++) {
                var records = plot.data[i].length;
                for (var j = 0; j < records; j++) {
                    temperatureMax = temperatureMax > plot.data[i][j].temperature ? temperatureMax : plot.data[i][j].temperature;
                    temperatureMin = temperatureMin < plot.data[i][j].temperature ? temperatureMin : plot.data[i][j].temperature;
                }
            }

            temperatureMax = Math.round(temperatureMax * 2);
            temperatureMin = Math.round(temperatureMin - 5);
            
            if(!temperatureMax || !temperatureMin) return;

            var steps = Math.ceil((temperatureMax - temperatureMin) / 5);
            var temperatureScreenRatio = chartHeight / (temperatureMax - temperatureMin);

            context.save();
            context.textAlign = "left";
            for (var i = 0; i < steps; i++) {
                var y = Math.round(chartHeight + self.options.chart.marginTop - i * 5 * temperatureScreenRatio);
                var x = chartWidth + self.options.chart.marginLeft;
                context.fillText(temperatureMin + i * 5 + " °C", x + 1, y + 5);
            }
            context.stroke();
            context.restore();
            for (var i = 0; i < 2; i++) {
                context.beginPath();
                for (var j = 0; j < stageConsumption.length; j++) {
                    if (stageConsumption[j].group == i) {
                        var _y = Math.round(chartHeight + self.options.chart.marginTop + (temperatureMin - stageConsumption[j].temperature) * temperatureScreenRatio);
                        var _x = Math.round(stageConsumption[j].x + stageConsumption[j].width / 2);
                        context.lineTo(_x, _y);
                        context.strokeStyle = self.options.colors.temperature[i];
                        context.lineWidth = 2;
                        context.fillStyle = self.options.colors.temperature[i];
                        context.fillRect(_x - 3, _y - 3, 6, 6);
                    }

                }
                context.stroke();
            }
            context.restore();
        }

        function init() {
            drawXAxis(0, max, 10, consumptionScreenRatio);

            plotBars();
            if (self.options.temperature == true) {
                drawTemperaturePolygon()
            }

        }

        self.rotate = function (r) {
            context.save();
            self.rotated = r == true;
            if (self.rotated == true) {
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
            context.restore();
        }

        chartCollection.push(this); //add to collection

        if (window.innerWidth < 321) {
            self.rotate(true);
        } else {
            self.rotate(false);
        }

        return this;
    }
    window.Chart.prototype.defaults = {
        font : "12pt sans-serif",
        labelColor : "rgba(128,128,128, 1)",
        lastYear : true,
        colors : {
            bar : {
                electric : ["#968C83", "#FFc72C"],
                gas : ["#CAC4C0", "#00B5E2"]
            },
            block : {
                electric : ["#cbc6c1", "#ffd56e"],
                gas : ["#CAC4C0", "#00B5E2"]
            },
            temperature : ["#b6c528", "#fec435"]//["#ffc537", "#b5c329"]
        },
        units : {
            electric : {
                consumption : "kWh",
                temperature : "°C"
            },
            gas : {
                consumption : "GJ",
                temperature : "°C"
            }
        },
        bar : {
            margin : 10,
            marginCompare : 5,
            label : true
        },
        chart : {
            marginTop : 0,
            marginRight : 50,
            marginBottom : 30,
            marginLeft : 50
        },
        axes : {
            yMax : 1.2,
            xFont : "10pt sans-serif",
            yFont : "10pt sans-serif",
            color : "#DFDCD9"
        },
        temperature : false,
        plot : {
            labels : [""],
            units : {
                consumption : "",
                temperature : ""
            },
            data : [[{
                        consumption : 0,
                        temperature : 0,
                        threshold : 0
                    }
                ]
            ],
        }
    }

    //make global responsive
    var $window = $(window);
    $window.on('resize', function (e) {
        var chart;
        if (window.innerWidth < 361) {
            for (var i = 0; i < chartCollection.length; i++) {
                if (!chartCollection[i].rotated) {
                    chartCollection[i].rotate(true);
                }
            }
        } else {
            for (var i = 0; i < chartCollection.length; i++) {
                if (chartCollection[i].rotated) {
                    chartCollection[i].rotate(false);
                }
            }
        }

    });

}
    ());
