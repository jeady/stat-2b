// Searches the element's ancestry to make the element take up space (but still
// not shown - i.e. temporarly change display: none to visibility: hidden),
// execute func, and then set everything back the way it was. This means we can
// correctly perform size calculations in func() regardless of whether the
// element is meant to be visible now or later.
function doWhileVisible(element, func) {
  var rehide = [];
  element.parents().each(function(i, e) {
    e = jQuery(e);
    if (e.is(':hidden')) {
      e.show();
      rehide.push([e, e.css('visibility')]);
      e.css('visibility', 'hidden');
    }
  });
  func();
  jQuery.each(rehide, function(i, e) {
    e[0].hide();
    e[0].css('visibility', e[1]);
  });
}
