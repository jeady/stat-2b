// Author: James Eady <jeady@berkeley.edu>
//
// This file defines a javascript toggle button.
//
// Usage:
// $('body').append(new SticiToggleButton({
//   trueLabel: 'On',
//   falseLabel: 'Off',
//   value: false,
//   change: function(e, is_on) {
//     if (is_on)
//       alert('On!');
// }}));
function SticiToggleButton(params) {
  var self = this;

  // Make this object jQuery compatible by making it a jQuery object.
  self = jQuery('<button/>').addClass('stici_togglebutton');

  // Options.
  var options = {
    trueLabel: 'On',
    falseLabel: 'Off',
    value: false,
    change: function(e, is_on) {}
  };
  jQuery.extend(options, params);

  // Accessors.
  self.is_true = self.is_toggled = self.toggled = function() {
    return options.value;
  };
  self.is_false = function() {
    return !options.value;
  };

  // Helper method.
  function setLabel() {
    if (options.value)
      self.text(options.trueLabel);
    else
      self.text(options.falseLabel);
  }

  // Set up the button.
  self.click(function(e) {
    e.preventDefault();

    options.value = !options.value;
    setLabel();

    options.change(e, options.value);
  });

  setLabel();

  return self;
}
