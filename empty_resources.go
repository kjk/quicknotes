// +build !embeded_resources

package main

// for dev, this is empty and we read resources from file system.
// for release, we pack resources into a zip file and generate
// resources.go where resourcesZipData is the content of that zip
// and use embedded_resources build tag
var resourcesZipData = []byte{}
