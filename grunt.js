module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    lint: {
      all: ['grunt.js', 'lib/*.js']
    },
    min: {
      all: {
        src: 'sticigui.js',
        dest: 'sticigui.js'
      }
    },
    concat: {
      all: {
        src: ['lib/*.js'],
        dest: 'sticigui.js'
      }
    }
  });


  grunt.registerTask('default', 'lint concat min');
  grunt.registerTask('debug', 'lint concat');

};
