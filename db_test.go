package main

import (
	"reflect"
	"testing"
)

func testSerializeTagsOne(t *testing.T, tags []string, expSerialized string) {
	serialized := serializeTags(tags)
	if expSerialized != serialized {
		t.Fatalf("exp: '%s', got: '%s'", serialized, expSerialized)
	}
	deserialized := deserializeTags(serialized)
	if !reflect.DeepEqual(tags, deserialized) {
		t.Fatalf("exp: %#v, got: %#v", tags, deserialized)
	}
}

func TestSerializeTags(t *testing.T) {
	testSerializeTagsOne(t, nil, "")
	testSerializeTagsOne(t, []string{"one"}, "one")
	testSerializeTagsOne(t, []string{"one", "two"}, "one"+tagSepStr+"two")
}
