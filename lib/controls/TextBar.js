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
  var label = jQuery('<span/>');
  var input = jQuery('<input type="text"/>');
  var slider = jQuery('<div/>');

  // Compose the pieces.
  self.append(jQuery('<div/>').append(label, input));
  self.append(jQuery('<div/>').append(slider));

  // Accessor and modifier functions.
  self.min = function(min) {
    if (min !== undefined) {
      self.options.min = min;
      slider.slider('min', self.options.min);
      self.val(self.val());
      return self;
    }
    return self.options.min;
  };
  self.max = function(max) {
    if (max !== undefined) {
      self.options.max = max;
      slider.slider('max', self.options.max);
      self.val(self.val());
      return self;
    }
    return self.options.max;
  };
  self.bounds = function(min, max) {
    self.min(min);
    self.max(max);
    return self;
  };
  self.step = function(step) {
    if (step !== undefined) {
      self.options.step = step;
      slider.slider('step', self.options.step);
      self.val(self.val());
      return self;
    }
    return self.options.step;
  };
  self.val = function(val) {
    if (val !== undefined) {
      // Set the slider value first and allow it to do things like bounds
      // and step checking for us.
      slider.slider('value', val);

      val = slider.slider('value');
      input.val(val);
      return input.val();
    }
    return val;
  };
  self.label = function(label) {
    if (label !== undefined) {
      self.options.label = label;
      label.text(self.options.label);
      return self;
    }
    return self.options.label;
  };
  self.change = function(change) {
    if (change !== undefined) {
      self.options.change = change;
      return self;
    }
    return self.options.change;
  };

  // Initialize the pieces.
  label.text(self.options.label);
  input.change(onChange);
  slider.slider({
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
