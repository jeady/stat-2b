function Venn(container_id) {

  this.env = jQuery('#' + container_id);
  var app = jQuery('<div/>',{id:container_id + 'app'}).addClass('stici_venn');
  this.env.append(app);

  var container = jQuery('<div/>',{id:container_id + 'container'}).addClass('container');
  var buttons = jQuery('<div/>',{id:container_id + 'buttons'}).addClass('buttons');
  var scrollbars = jQuery('<div/>',{id:container_id + 'scrollbars'}).addClass('scrollbars');

  var box0, box1, box2, fillArea, layer;

  var button_args = [
    ['S', function () {
         box0.setFill('blue');
         box1.setFill('none');
         box2.setFill('none');
         fillArea.setFill('blue');
         fillArea.setStroke('black');
         layer.draw();
       }],

    ['A', function () {
         box0.setFill('#eee');
         box1.setFill('blue');
         box2.setFill('none');
         fillArea.setFill('blue');
         layer.draw();
       }],

    ['B', function () {
         box1.setFill('none');
         box0.setFill('#eee');
         fillArea.setFill('blue');
         box2.setFill('blue');
         layer.draw();
       }],

    ['Ac', function () {
         box2.setFill('none');
         box1.setFill('#eee');
         box0.setFill('blue');
         fillArea.setFill('#eee');
         layer.draw();
       }],

    ['Bc', function () {
         box1.setFill('none');
         box2.setFill('#eee');
         box0.setFill('blue');
         fillArea.setFill('#eee');
         layer.draw();
       }],

    // NOT QUITE RIGHT need to group
    ['A or B', function () {
         box0.setFill('#eee');
         box1.setFill('blue');
         box2.setFill('blue');
         fillArea.setFill('blue');
         layer.draw();
       }],

    ['{}', function () {
         box0.setFill('#eee');
         box1.setFill('none');
         box2.setFill('none');
         fillArea.setFill('#eee');
         layer.draw();
       }],

    // FIX
    ['AB', function () {
        box0.setFill('#eee');
        box1.setFill('none');
        box2.setFill('none');
        fillArea.setFill('blue');
        //fillArea.setPosition()
        layer.draw();
      }],

    ['ABc', function () {
        box0.setFill('#eee');
        box1.setFill('blue');
        box2.setFill('#eee');
        fillArea.setFill('#eee');
        // fillArea.setPosition()
        // fillArea.setFill('none');
        layer.draw();
       }],

    ['AcB', function () {
         box0.setFill('#eee');
         box2.setFill('blue');
         box1.setFill('#eee');
         fillArea.setFill('#eee');
         layer.draw();
       }]];
  $.each(button_args, function(i, button_arg) {
    var button_name = button_arg[0];
    var button_action = button_arg[1];
    var button = jQuery('<div/>').addClass('button');
    buttons.append(button);
    var inp = jQuery('<input/>',{type:'radio',name:'buttons'});
    var label = jQuery('<label/>').click(function() {inp.prop('checked', true);});
    button.click(button_action);
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
  app.append(container);
  app.append(buttons);
  app.append(scrollbars);

  var scaleFactorX = 0.3;
  var scaleFactorY = 0.3;

  function draw() {

    var stage = new Kinetic.Stage({
      container: container_id + 'container',
        width: 340,
        height: 200
    });

    var messageLayer = new Kinetic.Layer();
    layer = new Kinetic.Layer();
    var rectX = stage.getWidth() / 2 - 50;
    var rectY = stage.getHeight() / 2 - 25;

    // Groups for text label & each box.
    var group1 = new Kinetic.Group({
      draggable: true
    });

    var group2 = new Kinetic.Group({
      draggable:true
    });

    box0 = new Kinetic.Rect({
      x: 10,
        y: 10,
        width: 320,
        height: 180,
        fill: '#eee',
        stroke: 'black',
        strokeWidth: 1,
        draggable: false
    });

    var textBox0 = new Kinetic.Text({
      x: 14,
        y: 14,
        text: 'S',
        fontSize: 14,
        fontFamily: 'sans-serif',
        fill: 'black'
    });

    box1 = new Kinetic.Rect({
      x: rectX - 32,
        y: rectY - 16,
        width: 320 * scaleFactorX,
        height: 180 * scaleFactorY,
        fill: 'none',
        stroke: 'black',
        strokeWidth: 1
    });

    var textBox1 = new Kinetic.Text({
      x: rectX - 28,
        y: rectY - 14,
        text: 'A',
        fontSize: 14,
        fontFamily: 'sans-serif',
        fill: 'black'
    });

    box2 = new Kinetic.Rect({
      x: rectX + 32,
        y: rectY + 16,
        width: 320 * scaleFactorX,
        height: 180 * scaleFactorY,
        fill: 'none',
        stroke: 'black',
        strokeWidth: 1
    });

    var textBox2 = new Kinetic.Text({
      x: rectX + 34,
        y: rectY + 18,
        height: 20,
        text: 'B',
        fontSize: 14,
        fontFamily: 'sans-serif',
        fill: 'black'
    });



    //box1.simulate('click');
    //box2.simulate('click');

    $('#' + container_id + 'sbA').change(function () {
    var data = getInfo();
      box1.setWidth((320*this.value)/100);
      box1.setHeight((180*this.value)/100);
      fillArea.setWidth(data[2]);
      fillArea.setHeight(data[3]);
      layer.draw();
    });

    $('#' + container_id + 'sbB').change(function () {
    var data = getInfo();
      box2.setWidth((320*this.value)/100);
      box2.setHeight((180*this.value)/100);
      fillArea.setWidth((320*this.value)/100-64);
      fillArea.setHeight((180*this.value)/100-32);
      layer.draw();
    });

    $('#' + container_id + 'sbAt').change(function () {
    var data = getInfo();
      box1.setWidth((320*this.value)/100);
      box1.setHeight((180*this.value)/100);
      fillArea.setWidth((320*this.value)/100-64);
      fillArea.setHeight((180*this.value)/100-32);
      layer.draw();
    });

    $('#' + container_id + 'sbBt').change(function () {
    var data = getInfo();
      box2.setWidth((320*this.value)/100);
      box2.setHeight((180*this.value)/100);
      fillArea.setWidth((320*this.value)/100-64);
      fillArea.setHeight((180*this.value)/100-32);
      layer.draw();
    });

    group1.add(box1);
    group1.add(textBox1);

    group2.add(box2);
    group2.add(textBox2);

    layer.add(box0);
    layer.add(textBox0);
    layer.add(group1);
    layer.add(group2);

  var data = getInfo();
    fillArea = new Kinetic.Rect({
        x: data[0],
        y: data[1],
        width: data[2],
        height: data[3],
        fill: 'blue',
        stroke: 'black',
        strokeWidth: 0.5
    });

    layer.add(fillArea);

    stage.add(layer);
    stage.add(messageLayer);

  function doIntersect(rect1, rect2) {
    var rect1pos = rect1.getPosition(),
      rect2pos = rect2.getPosition(),
      rect1width = rect1.getWidth(),
      rect1height = rect1.getHeight(),
      rect2width = rect2.getWidth(),
      rect2height = rect2.getHeight();

    return !(rect2pos.x > rect1pos.x + rect1width || rect2pos.x + rect2width < rect1pos.x || rect2pos.y > rect1pos.y + rect1height || rect2pos.y + rect2height < rect1pos.y);
  }

  function getInfo() {

    var result = [];

    if (doIntersect(box1, box2)) {

      var box1pos = box1.getPosition(),
        box2pos = box2.getPosition(),
        box1width = box1.getWidth(),
        box1height = box1.getHeight(),
        box2width = box2.getWidth(),
        box2height = box2.getHeight();

        //Intersection code

        console.log(result);
    }
    return result;
  }

  }
  draw();
}
