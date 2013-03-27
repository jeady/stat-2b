// Author: James Eady <jeady@berkeley.edu>
//
// This file defines a javascript check box.
//
// Usage:
// $('body').append(new SticiCheck({
//   label: 'Check to turn on',
//   readonly: false,
//   value: false,
//   change: function(e, is_checked) {
//     if (is_checked)
//       alert('On!');
// }}));
function SticiCheck(params) {
  var self = this;

  // Make this object jQuery compatible by making it a jQuery object.
  self = jQuery('<div/>').addClass('stici_check');
  var check = jQuery('<input type="checkbox"/>');
  var label = jQuery('<span/>');

  // Options.
  var options = {
    label: 'Checkbox',
    readonly: false,
    value: false,
    change: function(e, is_checked) {}
  };
  jQuery.extend(options, params);

  // Accessors.
  self.label = function(l) {
    if (l !== undefined) {
      options.label = l;
      label.text(options.label);
      return self;
    }
    return options.l;
  };
  self.val = self.checked = function(val) {
    if (val !== undefined) {
      options.value = val;
      return self;
    }
    return options.value;
  };
  self.change = function(c) {
    if (c !== undefined) {
      options.change = c;
      return self;
    }
    return options.change;
  };

  // Build the UI.
  check.prop('checked', options.value);
  label.text(options.label);

  if (!options.readonly)
    self.append(check);
  self.append(label);

  check.change(function(e) {
    e.preventDefault();
    self.val(check.is(':checked'));
    e.target = self;

    options.change(e, self.val());
  });

  return self;
}
