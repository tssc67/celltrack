#ifndef TIFF_H
#define TIFF_H

#include <node.h>
#include <node_object_wrap.h>

namespace demo {

class tiff : public node::ObjectWrap {
 public:
  static void Init(v8::Isolate* isolate);
  static void NewInstance(const v8::FunctionCallbackInfo<v8::Value>& args);
  inline double value() const { return value_; }

 private:
  explicit tiff(double value = 0);
  ~tiff();

  static void New(const v8::FunctionCallbackInfo<v8::Value>& args);
  static v8::Persistent<v8::Function> constructor;
  double value_;
};

}  // namespace demo

#endif