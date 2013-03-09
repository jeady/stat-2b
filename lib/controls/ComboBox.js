// Author: James Eady <jeady@berkeley.edu>
//
// This file defines a javascript combo box.
//
// Usage:
// $('body').append(new SticiComboBox({
//   label: 'Choose your favorite pet: ',
//   options: {
//     'cats'         : 'MEOW!',
//     'dogs'         : 'WOOF!',
//     'anything else': 'Fascinating...'
//   },
//   selected: 'cats',
//   change: function(e, value, label) {
//     alert(value);
// }}));
function SticiComboBox(params) {
  var self = this;

  // Make this object jQuery compatible by making it a jQuery object.
  self = jQuery('<div/>').addClass('stici_combobox');
  var label = jQuery('<span/>');
  var select = jQuery('<select/>');

  // Options.
  var options = {
    label: 'Choose: ',
    options: {
      'foo': null,
      'bar': null
    },
    selected: null,
    change: function(e, value, label) {}
  };
  jQuery.extend(options, params);

  // Accessors and modifiers.
  self.val = function(val) {
    if (val !== undefined) {
      jQuery.each(options.options, function(key, value) {
        if (val == value)
          self.selected(key);
      });
      return self;
    }
    return options.options[select.val()];
  };
  self.selected = function(label) {
    if (label !== undefined) {
      select.val(label);
      return self;
    }
    return select.val();
  };
  self.options = function(opts) {
    if (opts !== undefined) {
      options.options = opts;
      select.children().remove();
      jQuery.each(options.options, function(key, value) {
        var opt =
          jQuery('<option/>').data('value', value).text(key);
        select.append(opt);
      });
      return self;
    }
    return options.options;
  };

  // Put things together.
  label.text(options.label);
  self.append(label, select);

  // Fill in the combobox.
  self.options(options.options);
  if (options.selected !== null)
    self.selected(options.selected);

  // Change handler, which will in turn dispatch the event to the user.
  self.change(function(e) {
    e.preventDefault();

    options.change(e, self.val(), select.val());
  });

  return self;
}
