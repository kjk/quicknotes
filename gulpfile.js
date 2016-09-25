var babelify = require('babelify');
var browserify = require('browserify');
var buffer = require('vinyl-buffer');
var cssnano = require('gulp-cssnano');
var envify = require('envify/custom');
var exorcist = require('exorcist');
var gulp = require('gulp');
var mocha = require('gulp-mocha');
var prefix = require('gulp-autoprefixer');
var sass = require('gulp-sass');
var sourcemaps = require('gulp-sourcemaps');
var source = require('vinyl-source-stream');
var tsify = require('tsify');
var uglify = require('gulp-uglify');
var debug = require('gulp-debug');

require('babel-register');

var babelifyOpts = {
  presets: ['es2015', 'react'],
  extensions: ['.tsx', '.ts', '.js', '.jsx']
};

var tsifyOpts = {
  target: 'es6',
  module: 'es2015'
};

var browserifyOpts = {
  entries: ['js/App.tsx'],
  debug: true
};

gulp.task('js', function() {
  browserify(browserifyOpts)
    .plugin(tsify, tsifyOpts)
    .transform(babelify, babelifyOpts)
    .bundle()
    .pipe(exorcist('s/dist/bundle.js.map'))
    .pipe(source('bundle.js'))
    .pipe(gulp.dest('s/dist'));
});

gulp.task('jsprod', function() {
  var envifyOpts = {
    'global': true,
    '_': 'purge',
    NODE_ENV: 'production'
  };

  browserify(browserifyOpts)
    .plugin(tsify, tsifyOpts)
    .transform(babelify, babelifyOpts)
    .transform(envify(envifyOpts))
    .bundle()
    .pipe(source('bundle.min.js'))
    .pipe(buffer())
    .pipe(uglify())
    .pipe(gulp.dest('s/dist'));
});

gulp.task('css', function() {
  return gulp.src('./sass/*.scss')
    .pipe(sourcemaps.init())
    .pipe(sass().on('error', sass.logError))
    .pipe(prefix('last 2 versions'))
    .pipe(sourcemaps.write('.')) // this is relative to gulp.dest()
    .pipe(gulp.dest('./s/dist/'));
});

gulp.task('cssprod', function() {
  return gulp.src('./sass/*.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(prefix('last 2 versions'))
    .pipe(cssnano())
    .pipe(gulp.dest('./s/dist/'));
});

gulp.task('watch', function() {
  gulp.watch('js/*', ['js']);
  gulp.watch('./sass/**/*', ['css']);
});

gulp.task('prod', ['cssprod', 'jsprod']);
gulp.task('default', ['css', 'js']);
gulp.task('build_and_watch', ['default', 'watch']);
