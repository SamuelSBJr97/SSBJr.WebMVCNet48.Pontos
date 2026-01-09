(function($){
    if (!$) return;
    if (typeof $.fn.dropdown === 'undefined' && typeof bootstrap !== 'undefined' && bootstrap.Dropdown) {
        $.fn.dropdown = function(option){
            var args = arguments;
            return this.each(function(){
                var instance = bootstrap.Dropdown.getOrCreateInstance(this);
                if (typeof option === 'string') {
                    if (option === 'toggle') instance.toggle();
                    else if (option === 'show') instance.show();
                    else if (option === 'hide') instance.hide();
                    else if (option === 'dispose') instance.dispose();
                }
            });
        };
        // Expor a Constructor esperada pelo bootstrap-select
        $.fn.dropdown.Constructor = bootstrap.Dropdown;
        try {
            $.fn.dropdown.Constructor.VERSION = (bootstrap && bootstrap.Tooltip && bootstrap.Tooltip.VERSION) ? bootstrap.Tooltip.VERSION : (bootstrap && bootstrap.VERSION) ? bootstrap.VERSION : '5';
        } catch (e) {
            $.fn.dropdown.Constructor.VERSION = '5';
        }
        if (!$.fn.dropdown.Constructor._dataApiKeydownHandler) {
            $.fn.dropdown.Constructor._dataApiKeydownHandler = function(){};
        }
    }
})(window.jQuery);