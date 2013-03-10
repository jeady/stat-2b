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
  var options = {
    min: 0,
    max: 100,
    step: 1,
    value: 25,
    label: '',
    change: function(e, value) {}
  };
  jQuery.extend(options, params);

  // Create the basic pieces.
  var label = jQuery('<span/>').addClass('stici_textbar_label');
  var input = jQuery('<input type="text"/>').addClass('stici_textbar_input');
  var slider = jQuery('<div/>').addClass('stici_textbar_slider');

  // Compose the pieces.
  self.append(jQuery('<div/>').append(label, input));
  self.append(jQuery('<div/>').append(slider));

  // Accessor and modifier functions.
  self.min = function(min) {
    if (min !== undefined) {
      options.min = min;
      slider.slider('option', 'min', options.min);
      self.val(self.val());
      return self;
    }
    return options.min;
  };
  self.max = function(max) {
    if (max !== undefined) {
      options.max = max;
      slider.slider('option', 'max', options.max);
      self.val(self.val());
      return self;
    }
    return options.max;
  };
  self.bounds = function(min, max) {
    self.min(min);
    self.max(max);
    return self;
  };
  self.step = function(step) {
    if (step !== undefined) {
      options.step = step;
      slider.slider('option', 'step', options.step);
      self.val(self.val());
      return self;
    }
    return options.step;
  };
  self.val = function(val) {
    if (val !== undefined) {
      // Set the slider value first and allow it to do things like bounds
      // checking.
      slider.slider('value', val);

      val = slider.slider('value');
      input.val(val);
      return self;
    }
    return slider.slider('value');
  };
  self.label = function(label) {
    if (label !== undefined) {
      options.label = label;
      label.text(options.label);
      return self;
    }
    return options.label;
  };
  self.change = function(change) {
    if (change !== undefined) {
      options.change = change;
      return self;
    }
    return options.change;
  };
  self.set = function(val, min, max, step) {
    return self.val(val).bounds(min, max).step(step);
  };

  // Initialize the pieces.
  label.text(options.label);
  input.change(onChange);
  slider.slider({
    min: options.min,
    max: options.max,
    step: options.step,
    value: options.value,
    slide: onChange
  });
  input.val(slider.slider('value'));

  // This function receives a change event and sets both the slider and text
  // input equal to the event value. Used as the change callback for both
  // inputs.
  function onChange(e, ui) {
    var value;
    e.target = self;

    // If ui is undefined, we are coming from the text input.
    if (ui === undefined)
       value = jQuery(this).val();
    else
      value = ui.value;

    // This method will do bounds and step checking so use it.
    self.val(value);
    options.change(e, self.val());
  }

  return self;
}
