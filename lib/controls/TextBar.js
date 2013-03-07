// Author: James Eady <jeady@berkeley.edu>
//
// This file defines a javascript control that consists of both a text input
// and a jQuery-UI slider.
//
// Usage:
// $('body').append(new SticiTextBar({
//   label: 'Insanity',
//   min: 0,
//   max: 10000,
//   step: 1,
//   value: 2000,
//   change: function(e, value) {
//     if (value > 9000)
//       alert('OVER 9000!!!');
//   }}));
function SticiTextBar(params) {
  var self = this;

  // Make this object jQuery compatible by making it a jQuery object.
  self = jQuery('<div/>').addClass('stici_textbar');

  // Options.
  self.options = {
    min: 0,
    max: 100,
    step: 1,
    value: 25,
    label: '',
    change: function(e, value) {}
  };
  jQuery.extend(self.options, params);

  // Create the basic pieces.
  self.label = jQuery('<span/>');
  self.input = jQuery('<input type="text"/>');
  self.slider = jQuery('<div/>');

  // Compose the pieces.
  self.append(jQuery('<div/>').append(self.label, self.input));
  self.append(jQuery('<div/>').append(self.slider));

  // Accessor functions.
  self.val = function(val) {
    if (val !== undefined) {
      // Set the slider value first and allow it to do things like bounds
      // and step checking for us.
      self.slider.slider('value', val);

      val = self.slider.slider('value');
      self.input.val(val);
    }

    return val;
  };

  // Initialize the pieces.
  self.label.text(self.options.label);
  self.input.change(onChange);
  self.slider.slider({
    min: self.options.min,
    max: self.options.max,
    step: self.options.step,
    slide: onChange
  });
  self.val(self.options.value);

  // This function receives a change event and sets both the slider and text
  // input equal to the event value. Used as the change callback for both
  // inputs.
  function onChange(e, ui) {
    var value;

    // If ui is undefined, we are coming from the text input.
    if (ui === undefined)
       value = jQuery(this).val();
    else
      value = ui.value;

    // This method will do bounds and step checking so use it.
    value = self.val(value);
    self.options.change(e, value);
  }

  return self;
}
