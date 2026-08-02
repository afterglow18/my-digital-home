#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// ObjC bridge file — registers the Swift VisionPlugin with the Capacitor runtime.
CAP_PLUGIN(VisionPlugin, "VisionPlugin",
    CAP_PLUGIN_METHOD(analyze, CAPPluginReturnPromise);
)
