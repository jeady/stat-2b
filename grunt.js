module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    lint: {
      all: ['grunt.js', 'lib/*.js']
    },
    min: {
      all: ['lib/*.js']
    },
    concat: {
      all: {
        src: ['lib/*.js'],
        dest: 'sticigui.js'
      }
    }
  });


  grunt.registerTask('default', 'lint min concat');

};
