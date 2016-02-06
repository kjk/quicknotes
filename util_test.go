package main

import "testing"

func TestTrimSpaceLineRight(t *testing.T) {
	tests := []string{
		"", "",
		"a", "a",
		"a\n", "a",
		"\na", "\na",
		"ab\r", "ab",
	}

	n := len(tests) / 2
	for i := 0; i < n; i++ {
		test := tests[i*2]
		exp := tests[i*2+1]
		got := trimSpaceLineRight(test)
		if got != exp {
			t.Errorf("for '%s' got '%s', expected '%s'", test, got, exp)
		}
	}
}

func TestNameFromEmail(t *testing.T) {
	tests := []string{
		"kkowalczyk@gmail.com", "kkowalczyk",
		"foobar.com", "foobar.com",
		"foo@bar@com", "foo",
	}
	n := len(tests) / 2
	for i := 0; i < n; i++ {
		test := tests[i*2]
		exp := tests[i*2+1]
		got := nameFromEmail(test)
		if got != exp {
			t.Errorf("for '%s' got '%s', expected '%s'", test, got, exp)
		}
	}
}

func checkArrEqual(t *testing.T, a1, a2 []string) {
	areEqual := strArrEqual(a1, a2)
	if !areEqual {
		t.Errorf("expected %v and %v to be equal (len(a1)=%d, len(a2)=%d)", a1, a2, len(a1), len(a2))
	}
}

func checkArrNotEqual(t *testing.T, a1, a2 []string) {
	areEqual := strArrEqual(a1, a2)
	if areEqual {
		t.Errorf("expected %v and %v to not be equal", a1, a2)
	}
}

func TestStrArrEqual(t *testing.T) {
	checkArrEqual(t, nil, nil)
	checkArrEqual(t, []string{}, nil)
	checkArrEqual(t, nil, []string{})
	checkArrEqual(t, []string{}, []string{})
	checkArrEqual(t, []string{"foo"}, []string{"foo"})
	checkArrNotEqual(t, []string{"foo"}, []string{"bar"})
	checkArrNotEqual(t, []string{"foo"}, []string{"Foo"})
	checkArrEqual(t, []string{"foo", "bar", "foo"}, []string{"bar", "foo", "bar"})
	checkArrNotEqual(t, []string{"bar"}, []string{"bar", "foo"})
}

func testStrArrRemoveEmptyOne(t *testing.T, src []string, exp []string) {
	got := strArrRemoveEmpty(src)
	checkArrEqual(t, exp, got)
}

func TestStrArrRemoveEmpty(t *testing.T) {
	var a1, a2 []string
	a1 = []string{""}
	a2 = []string{}
	testStrArrRemoveEmptyOne(t, a1, a2)
	a1 = []string{"foo", "bar"}
	a2 = []string{"foo", "bar"}
	testStrArrRemoveEmptyOne(t, a1, a2)
	a1 = []string{"foo"}
	a2 = []string{"foo"}
	testStrArrRemoveEmptyOne(t, a1, a2)
	a1 = []string{"", "foo"}
	a2 = []string{"foo"}
	testStrArrRemoveEmptyOne(t, a1, a2)
	a1 = []string{"foo", ""}
	a2 = []string{"foo"}
	testStrArrRemoveEmptyOne(t, a1, a2)
	a1 = []string{"", ""}
	a2 = []string{}
	testStrArrRemoveEmptyOne(t, a1, a2)
	a1 = []string{"", "foo", "", "bar", ""}
	a2 = []string{"foo", "bar"}
	testStrArrRemoveEmptyOne(t, a1, a2)
}
