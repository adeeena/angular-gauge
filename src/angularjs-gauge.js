(function (angular) {
    'use strict';
    angular
        .module('angularjs-gauge', [])
        .directive('ngGauge', gaugeMeterDirective)
        .provider('ngGauge', gaugeMeterProviderFn);

    gaugeMeterProviderFn.$inject = [];
    function gaugeMeterProviderFn() {
        let defaultOptions = {
            size: 200,
            value: undefined,
            min: 0,
            max: 100,
            cap: 'butt',
            thick: 6,
            type: 'full',
            foregroundColor: 'rgba(0, 150, 136, 1)',
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            duration: 1500,
            fractionSize: null,
            labelOnly: false
        };

        this.setOptions = function (customOptions) {
            if (!(customOptions && angular.isObject(customOptions))) {
                    throw new Error('Invalid option type specified in the ngGaugeProvider');
            }
            defaultOptions = angular.merge(defaultOptions, customOptions);
        };

        const ngGauge = {
            getOptions() {
                return angular.extend({}, defaultOptions);
            }
        };

        this.$get = function () {
            return ngGauge;
        };
    }

    gaugeMeterDirective.$inject = ['ngGauge'];

    function gaugeMeterDirective(ngGauge) {
        const tpl = '<div style="display:inline-block;text-align:center;position:relative;">' +
            '<span ng-show="{{!labelOnly}}"><u>{{prepend}}</u>' +
            '<span ng-if="fractionSize === null">{{value | number}}</span>' +
            '<span ng-if="fractionSize !== null">{{value | number: fractionSize}}</span>' +
            '<u>{{append}}</u></span>' +
            '<b>{{ label }}</b>' +
            '<canvas></canvas></div>';

        const Gauge = function(element, options) {
            this.element = element.find('canvas')[0];
            this.text = element.find('span');
            this.legend = element.find('b');
            this.unit = element.find('u');
            this.context = this.element.getContext('2d');
            this.options = options;
            this.init();
        };

        Gauge.prototype = {
            init() {
                this.setupStyles();
                this.create(null, null);
            },

            setupStyles() {
                this.context.canvas.width = this.options.size;
                this.context.canvas.height = this.options.size;
                this.context.lineCap = this.options.cap;
                this.context.lineWidth = this.options.thick;

                const lfs = this.options.size * 0.22,
                    llh = this.options.size;

                this.text.css({
                    display: 'inline-block',
                    fontWeight: 'normal',
                    width: '100%',
                    position: 'absolute',
                    textAlign: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontSize: lfs + 'px',
                    lineHeight: llh + 'px'
                });

                this.unit.css({
                    textDecoration: 'none',
                    fontSize: '0.6em',
                    fontWeight: 200,
                    opacity: 0.8
                });

                let fs, lh;
                if (this.options.labelOnly) {
                    fs = lfs * 0.8;
                    lh = llh;
                } else {
                    fs = this.options.size / 13;
                    lh = (5 * fs) + parseInt(this.options.size, 10);
                }

                this.legend.css({
                    display: 'inline-block',
                    width: '100%',
                    position: 'absolute',
                    textAlign: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontWeight: 'normal',
                    fontSize: fs + 'px',
                    lineHeight: lh + 'px'
                });
            },
            create(nv, ov) {
                const self = this,
                    type = this.getType(),
                    bounds = this.getBounds(type),
                    duration = this.getDuration(),
                    min = this.getMin(),
                    max = this.getMax(),
                    value = this.clamp(this.getValue(), min, max),
                    start = bounds.head,
                    unit = (bounds.tail - bounds.head) / (max - min),
                    tail = bounds.tail,
                    color = this.getForegroundColorByRange(value);
                let requestId,
                    displacement = unit * (value - min),
                    startTime;

                if (nv && ov) {
                    displacement = unit * nv - unit * ov;
                }

                function animate(timestamp) {
                    timestamp = timestamp || new Date().getTime();
                    const runtime = timestamp - startTime;
                    const progress = Math.min(runtime / duration, 1);

                    let previousProgress;
                    if (ov) {
                        // Fixed calculation: (ov*unit) => ((ov-min)*unit).
                        previousProgress = (ov - min) * unit;
                    } else {
                        previousProgress = 0;
                    }

                    const middle = start + previousProgress + (displacement * progress);

                    self.drawShell(start, middle, tail, color);
                    if (runtime < duration) {
                        requestId = window.requestAnimationFrame(function(timestamp) {
                            animate(timestamp);
                        });
                    } else {
                        cancelAnimationFrame(requestId);
                    }
                }

                requestAnimationFrame(function(timestamp) {
                    startTime = timestamp || new Date().getTime();
                    animate(timestamp);
                });
            },

            getBounds(type) {
                let head, tail;
                if (type === 'semi') {
                    head = Math.PI;
                    tail = 2 * Math.PI;
                } else if (type === 'full') {
                    head = 1.5 * Math.PI;
                    tail = 3.5 * Math.PI;
                } else {
                    head = 0.8 * Math.PI;
                    tail = 2.2 * Math.PI;
                }

                return { head, tail };
            },

            drawShell(start, middle, tail, color) {
                const
                    context = this.context,
                    center = this.getCenter(),
                    radius = this.getRadius(),
                    foregroundColor = color,
                    backgroundColor = this.getBackgroundColor();

                this.clear();

                // never below 0%
                middle = Math.max(middle, start);

                // never exceed 100%
                middle = Math.min(middle, tail);

                context.beginPath();
                context.strokeStyle = backgroundColor;
                context.arc(center.x, center.y, radius, middle, tail, false);
                context.stroke();

                context.beginPath();
                context.strokeStyle = foregroundColor;
                context.arc(center.x, center.y, radius, start, middle, false);
                context.stroke();
            },

            clear() {
                this.context.clearRect(0, 0, this.getWidth(), this.getHeight());
            },

            update(nv, ov) {
                this.create(nv, ov);
            },

            destroy() {
                this.clear();
            },

            getRadius() {
                const center = this.getCenter();
                return center.x - this.getThickness();
            },

            getCenter() {
                const x = this.getWidth() / 2,
                    y = this.getHeight() / 2;
                return { x, y };
            },

            getValue() {
                return this.options.value;
            },
            getMin() {
                return this.options.min;
            },
            getMax() {
                return this.options.max;
            },
            getWidth() {
                return this.context.canvas.width;
            },

            getHeight() {
                return this.context.canvas.height;
            },

            getThickness() {
                return this.options.thick;
            },

            getBackgroundColor() {
                return this.options.backgroundColor;
            },

            getForegroundColor() {
                return this.options.foregroundColor;
            },

            getForegroundColorByRange(value) {
                const isNumber = function(value) {
                    return value && !isNaN(parseFloat(value)) && !isNaN(Number(value));
                };

                const match = Object.keys(this.options.thresholds)
                    .filter(function(item) { return isNumber(item) && Number(item) <= value; })
                    .sort(function(a, b) { return Number(a) > Number(b); }).reverse()[0];

                if (match) {
                    return this.options.thresholds[match].color || this.getForegroundColor();
                } else {
                    return this.getForegroundColor();
                }
            },

            getLineCap() {
                return this.options.cap;
            },

            getType() {
                return this.options.type;
            },

            getDuration() {
                return this.options.duration;
            },

            clamp(value, min, max) {
                return Math.max(min, Math.min(max, value));
            }
        };

        return {
            restrict: 'E',
            replace: true,
            template: tpl,
            scope: {
                append: '@?',
                backgroundColor: '@?',
                cap: '@?',
                foregroundColor: '@?',
                label: '@?',
                labelOnly: '@?',
                prepend: '@?',
                size: '@?',
                thick: '@?',
                type: '@?',
                duration: '@?',
                value: '=?',
                min: '=?',
                max: '=?',
                thresholds: '=?',
                fractionSize: '=?'

            },
            link(scope, element) {
                // fetching default settings from provider
                const defaults = ngGauge.getOptions();
                if (angular.isDefined(scope.min)) {
                    scope.min = scope.min;
                } else {
                    scope.min = defaults.min;
                }

                if (angular.isDefined(scope.max)) {
                    scope.max = scope.max;
                } else {
                    scope.max = defaults.max;
                }

                if (angular.isDefined(scope.value)) {
                    scope.value = scope.value;
                } else {
                    scope.value = defaults.value;
                }

                if (angular.isDefined(scope.size)) {
                    scope.size = scope.size;
                } else {
                    scope.size = defaults.size;
                }

                if (angular.isDefined(scope.cap)) {
                    scope.cap = scope.cap;
                } else {
                    scope.cap = defaults.cap;
                }

                if (angular.isDefined(scope.thick)) {
                    scope.thick = scope.thick;
                } else {
                    scope.thick = defaults.thick;
                }

                if (angular.isDefined(scope.type)) {
                    scope.type = scope.type;
                } else {
                    scope.type = defaults.type;
                }

                if (angular.isDefined(scope.duration)) {
                    scope.duration = scope.duration;
                } else {
                    scope.duration = defaults.duration;
                }

                if (angular.isDefined(scope.labelOnly)) {
                    scope.labelOnly = scope.labelOnly;
                } else {
                    scope.labelOnly = defaults.labelOnly;
                }

                if (angular.isDefined(scope.foregroundColor)) {
                    scope.foregroundColor = scope.foregroundColor;
                } else {
                    scope.foregroundColor = defaults.foregroundColor;
                }

                if (angular.isDefined(scope.backgroundColor)) {
                    scope.backgroundColor = scope.backgroundColor;
                } else {
                    scope.backgroundColor = defaults.backgroundColor;
                }

                if (angular.isDefined(scope.thresholds)) {
                    scope.thresholds = scope.thresholds;
                } else {
                    scope.thresholds = {};
                }

                if (angular.isDefined(scope.fractionSize)) {
                    scope.fractionSize = scope.fractionSize;
                } else {
                    scope.fractionSize = defaults.fractionSize;
                }

                const gauge = new Gauge(element, scope);

                scope.$watch('value', watchData, false);
                scope.$watch('min', watchData, false);
                scope.$watch('max', watchData, false);
                scope.$watch('cap', watchOther, false);
                scope.$watch('thick', watchOther, false);
                scope.$watch('type', watchOther, false);
                scope.$watch('size', watchOther, false);
                scope.$watch('duration', watchOther, false);
                scope.$watch('foregroundColor', watchOther, false);
                scope.$watch('backgroundColor', watchOther, false);
                scope.$watch('thresholds', watchOther, false);
                scope.$watch('fractionSize', watchData, false);

                scope.$on('$destroy', function() {});
                scope.$on('$resize', function() {});

                function watchData(nv, ov) {
                    if (!gauge) {
                        return;
                    }

                    if (!angular.isDefined(nv) || angular.equals(nv, ov)) {
                        return;
                    }

                    gauge.update(nv, ov);
                }

                function watchOther(nv, ov) {
                    if (!angular.isDefined(nv) || angular.equals(nv, ov)) {
                        return;
                    }

                    gauge.destroy();
                    gauge.init();
                }
            }
        };
    }
}(angular));