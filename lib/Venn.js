function Venn(container_id) {
  var self = this;

  this.env = jQuery('#' + container_id);
  var app = jQuery('<div/>',{id:container_id + 'app'}).addClass('stici_venn');
  this.env.append(app);

  this.container = jQuery('<div/>',{id:container_id + 'container'}).addClass('container');
  var buttons = jQuery('<div/>',{id:container_id + 'buttons'}).addClass('buttons');
  var scrollbars = jQuery('<div/>',{id:container_id + 'scrollbars'}).addClass('scrollbars');

  app.append(self.container);
  app.append(buttons);
  app.append(scrollbars);

  var box0, box1, box2;

  var button_args = [
    ['S', function () {
         box0.addClass('selected');
         box1.removeClass('selected');
         box2.removeClass('selected');
       }],

    ['A', function () {
         box0.removeClass('selected');
         box1.addClass('selected');
         box2.removeClass('selected');
       }],

    ['B', function () {
         box0.removeClass('selected');
         box1.removeClass('selected');
         box2.addClass('selected');
       }],

    ['Ac', function () {
         box0.addClass('selected');
         box1.removeClass('selected');
         box2.removeClass('selected');
       }],

    ['Bc', function () {
         box0.addClass('selected');
         box1.removeClass('selected');
         box2.removeClass('selected');
       }],

    // NOT QUITE RIGHT need to group
    ['A or B', function () {
         box0.removeClass('selected');
         box1.addClass('selected');
         box2.addClass('selected');
       }],

    ['{}', function () {
         box0.removeClass('selected');
         box1.removeClass('selected');
         box2.removeClass('selected');
       }],

    // FIX
    ['AB', function () {
        box0.removeClass('selected');
        box1.removeClass('selected');
        box2.removeClass('selected');
      }],

    ['ABc', function () {
        box0.removeClass('selected');
        box1.addClass('selected');
        box2.removeClass('selected');
       }],

    ['AcB', function () {
         box0.removeClass('selected');
         box1.removeClass('selected');
         box2.addClass('selected');
       }]];
  $.each(button_args, function(i, button_arg) {
    var button_name = button_arg[0];
    var button_action = button_arg[1];
    var button = jQuery('<div/>').addClass('button');
    buttons.append(button);
    var inp = jQuery('<input/>',{type:'radio',name:'buttons'});
    var label = jQuery('<label/>').click(function() {inp.prop('checked', true);});
    button.click(function() {
      inp.prop('checked', true);
      button_action();
    });
    label.html(button_name);
    button.append(inp);
    button.append(label);
  });
  function createPercentControl(letter) {
    var sb = jQuery('<div/>',{id:container_id + 'psb' + letter}).addClass('scrollbar');
    var lbl = jQuery('<label/>').attr('for', container_id + 'sb'+letter);
    lbl.html('P(' + letter + ') (%)');
    var idFunc1 = "$('#" + container_id + "sb" + letter + "').val(this.value)";
    var idFunc2 = "$('#" + container_id + "sb" + letter + "t').val(this.value)";
    var input = jQuery('<input/>', {
      type: 'text',
      id: container_id + 'sb'+letter+'t',
      onkeyup: idFunc1,
      value: 30,
      size: 2
    });
    var input2 = jQuery('<input/>', {
      type: 'range',
      id: container_id + 'sb'+letter,
      onchange: idFunc2,
      min: 1,
      max: 100,
      step: 1,
      value: 30,
      style: 'width: 92px'
    });

    sb.append(lbl);
    sb.append(input);
    sb.append(input2);

    scrollbars.append(sb);
  }
  createPercentControl('A');
  createPercentControl('B');

  var scaleFactorX = 0.3;
  var scaleFactorY = 0.3;

  function draw() {

    box0 = jQuery('<div/>').addClass('box').addClass('S');
    box0.css('left', '10px');
    box0.css('top', '10px');
    box0.css('width', '320px');
    box0.css('height', '180px');
    box0.text('S');
    self.container.append(box0);

    var rectX = self.container.width() / 2 - 50;
    var rectY = self.container.height() / 2 - 25;

    box1 = jQuery('<div/>').addClass('box').addClass('A');
    box1.css('left', (rectX - 32) + 'px');
    box1.css('top', (rectY - 16) + 'px');
    box1.css('width', (320 * scaleFactorX) + 'px');
    box1.css('height', (180 * scaleFactorY) + 'px');
    box1.text('A');
    self.container.append(box1);
    box1.draggable();

    box2 = jQuery('<div/>').addClass('box').addClass('A');
    box2.css('left', (rectX + 32) + 'px');
    box2.css('top', (rectY + 16) + 'px');
    box2.css('width', (320 * scaleFactorX) + 'px');
    box2.css('height', (180 * scaleFactorY) + 'px');
    box2.text('B');
    self.container.append(box2);
    box2.draggable();


    $('#' + container_id + 'sbA').change(function () {
      box1.width((320*this.value/100) + 'px');
      box1.height((180*this.value/100) + 'px');
    });

    $('#' + container_id + 'sbB').change(function () {
      box2.width((320*this.value/100) + 'px');
      box2.height((180*this.value/100) + 'px');
    });

    $('#' + container_id + 'sbAt').change(function () {
      box1.width((320*this.value/100) + 'px');
      box1.height((180*this.value/100) + 'px');
    });

    $('#' + container_id + 'sbBt').change(function () {
      box2.width((320*this.value/100) + 'px');
      box2.height((180*this.value/100) + 'px');
    });
  }
  draw();
}
