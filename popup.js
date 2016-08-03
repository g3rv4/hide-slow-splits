var popupApp = angular.module('popupApp', ['ui.mask']);

popupApp.controller('PopupController', function PopupController($scope, $timeout) {
    var _this = this;
    _this.data = {};
    _this.default = {};
    _this.displayUnit = 'mile';

    _this.submit = function () {
        var data = angular.copy(_this.data);
        if(data.filters['min_pace']){
            var mins = parseFloat(data.filter_values.min_pace.substring(0, 1));
            var secs = parseFloat(data.filter_values.min_pace.substring(1));
            var totalMins = mins + secs / 60;

            if(_this.displayUnit == 'km')
                data.filter_values.min_pace = 16.6666666667 / totalMins;
            else
                data.filter_values.min_pace = 26.8224 / totalMins;
        }
        if(data.filters['min_distance']) {
            var distance = data.filter_values.min_distance;

            if(_this.displayUnit == 'km')
                data.filter_values.min_distance = distance * 1000;
            else
                data.filter_values.min_distance = distance * 1609.34;
        }

        var newData = {};
        newData[_this.url] = JSON.stringify(data);
        console.log(data);

        if(_this.make_default){
            newData['default_values'] = data;
        }
        chrome.storage.sync.set(newData, function() {
            chrome.tabs.query({'active': true, 'currentWindow': true}, function (tabs) {
                chrome.tabs.executeScript(tabs[0].id, {code: 'window.location.reload();'});
                window.close();
            });
        });
    };

    // add the watch after a small delay so that it doesn't affect the initial load
    $timeout(function(){
        $scope.$watch(function () {
            return _this.data.enabled;
        }, function (value, oldvalue) {
            if(value === false){
                chrome.storage.sync.remove(_this.url, function(){
                    chrome.tabs.query({'active': true, 'currentWindow': true}, function (tabs) {
                        chrome.tabs.executeScript(tabs[0].id, {code: 'window.location.reload();'});
                        window.close();
                    });
                });
            } else if (!oldvalue) {
                for (var name in _this.default)
                    if (_this.default.hasOwnProperty(name) && name != 'enabled')
                        _this.data[name] = angular.copy(_this.default[name]);
                if(_this.data.filters['min_pace'])
                    _this.setPace(_this.data.filter_values.min_pace, _this.data);
                if(_this.data.filters['min_distance'])
                    _this.setDistance(_this.data.filter_values.min_distance, _this.data);
            }
        });
    }, 500);

    _this.setDistance = function(distance, data){
        if(_this.displayUnit == 'km')
            data.filter_values.min_distance = parseFloat((distance / 1000.00).toFixed(2));
        else
            data.filter_values.min_distance = parseFloat((distance / 1609.34).toFixed(2));
    };

    _this.setPace = function(pace, data){
        var totalMins = pace;
        if(_this.displayUnit == 'km')
            totalMins = 16.6666666667 / totalMins;
        else
            totalMins = 26.8224 / totalMins;

        var mins = Math.floor(totalMins);
        var secs = Math.round((totalMins - mins) * 60);

        data.filter_values.min_pace = "" + mins + (secs < 10 ? '0' : '') + secs;
    };

    chrome.storage.sync.get('displayUnit', function (result) {
        if(result && result.displayUnit)
            _this.displayUnit = result.displayUnit;
    });

    chrome.storage.sync.get('default_values', function (result) {
        if(result && result.default_values)
            _this.default = result.default_values;
    });

    chrome.tabs.query({'active': true, 'currentWindow': true}, function (tabs) {
        if (tabs[0].url && tabs[0].url.match(/\/modern\/activity\/[0-9]+/)) {
            $scope.$apply(function () {
                _this.url = tabs[0].url;
                chrome.storage.sync.get(_this.url, function(previousData){
                    if (previousData && previousData[_this.url]) {
                        var data = JSON.parse(previousData[_this.url]);
                        if(data.filters['min_pace']){
                            _this.setPace(data.filter_values.min_pace, data);
                        }
                        if(data.filters['min_distance']) {
                            _this.setDistance(data.filter_values.min_distance, data);
                        }
                        _this.data = data;
                    }
                });
            });
        }
    });
});
