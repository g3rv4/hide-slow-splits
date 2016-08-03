function injectScript(source) {
    var elem = document.createElement("script");
    elem.type = "text/javascript";
    elem.innerHTML = source;
    //elem.innerHTML = source + ';debugger;';
    document.documentElement.appendChild(elem);
}

setTimeout(function(){
    // give it some time to build the page
    try {
        var distance = document.querySelector('#activitySmallStatsViewPlaceholder .data-bit').innerText;
        var unit = 'mile';
        if (distance.indexOf('km') !== -1) {
            unit = 'km';
        }
        chrome.storage.sync.set({'displayUnit': unit}, function(){
            // stored!
        });
    } catch (err){
        console.log(err);
    }
}, 5000);

chrome.storage.sync.get(window.location.href, function (previousData) {
    var urlData = {};
    if (previousData && previousData[window.location.href]) {
        urlData = previousData[window.location.href];

        injectScript("(" + (function (urlData) {
            urlData = JSON.parse(urlData);
            function bindResponse(request, response) {
                request.__defineGetter__("responseText", function () {
                    return response
                })
            }

            function includeLap(lap, urlData) {
                if(!urlData.enabled)
                    return true;

                var include = true;
                if(urlData.filters['min_pace'])
                    include = include && lap.averageSpeed >= urlData.filter_values.min_pace;
                if(urlData.filters['min_distance'])
                    include = include && lap.distance >= urlData.filter_values.min_distance;
                return include
            }

            function processSplits(request, urlData) {
                var data = JSON.parse(request.responseText);



                var meaningful = [];
                var index = 1;
                for (var i = 0; i < data.lapDTOs.length; i++)
                    if (includeLap(data.lapDTOs[i], urlData)) {
                        data.lapDTOs[i].lapIndex = index++;
                        meaningful.push(data.lapDTOs[i]);
                    }

                data.lapDTOs = meaningful;
                bindResponse(request, JSON.stringify(data));
            }

            function processDetails(request, splitsData) {
                var data = JSON.parse(request.responseText);

                var summary = data.summaryDTO;
                summary.distance = summary.duration = summary.elapsedDuration = summary.movingDuration =
                    summary.averageSpeed = summary.averageMovingSpeed = summary.averageHR = summary.maxHR = 0;

                for (var i = 0; i < splitsData.lapDTOs.length; i++) {
                    var current = splitsData.lapDTOs[i];
                    summary.distance += current.distance;
                    summary.elapsedDuration += current.elapsedDuration;
                    summary.duration += current.duration;
                    summary.movingDuration += current.movingDuration;
                    summary.averageSpeed += current.averageSpeed;
                    summary.averageMovingSpeed += current.averageMovingSpeed;
                    summary.averageHR += current.averageHR;
                    if (current.maxHR > summary.maxHR)
                        summary.maxHR = current.maxHR;
                }

                summary.averageSpeed /= splitsData.lapDTOs.length;
                summary.averageMovingSpeed /= splitsData.lapDTOs.length;
                summary.averageHR /= splitsData.lapDTOs.length;
                bindResponse(request, JSON.stringify(data));
            }

            var proxied = window.XMLHttpRequest.prototype.open;
            window.XMLHttpRequest.prototype.open = function (method, path, async) {
                if (path.match(/\/modern\/proxy\/activity-service\/activity\/[0-9]+\/splits/)) {
                    this.addEventListener('readystatechange', function () {
                        if (this.readyState === 4)
                            processSplits(this, urlData);
                    }, true);
                } else if (path.match(/\/modern\/proxy\/activity-service\/activity\/[0-9]+\?/)) {
                    this.addEventListener('readystatechange', function () {
                        if (this.readyState === 4) {
                            var _this = this;
                            $.ajax({
                                url: path.split('?')[0] + '/splits',
                                success: function (data) {
                                    processDetails(_this, data);
                                },
                                async: false
                            });
                        }
                    }, true);
                }
                return proxied.apply(this, [].slice.call(arguments));
            };
        }).toString() + ")(" + JSON.stringify(urlData) + ")");
    }
});
