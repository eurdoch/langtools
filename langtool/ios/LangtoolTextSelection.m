#import "LangtoolTextSelection.h"
#import <UIKit/UIKit.h>

@implementation LangtoolTextSelection

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
    return YES;
}

- (NSArray<NSString *> *)supportedEvents
{
    return @[@"onTextSelected"];
}

RCT_EXPORT_METHOD(setupTextSelection)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        [self addLangtoolMenuItem];
    });
}

- (void)addLangtoolMenuItem
{
    UIMenuController *menuController = [UIMenuController sharedMenuController];
    
    UIMenuItem *langtoolItem = [[UIMenuItem alloc] initWithTitle:@"Langtool" 
                                                          action:@selector(langtoolSelected:)];
    
    NSMutableArray *menuItems = [NSMutableArray arrayWithArray:menuController.menuItems];
    [menuItems addObject:langtoolItem];
    
    menuController.menuItems = menuItems;
    
    // Add observer for menu notifications
    [[NSNotificationCenter defaultCenter] addObserver:self
                                             selector:@selector(menuWillShow:)
                                                 name:UIMenuControllerWillShowMenuNotification
                                               object:nil];
}

- (void)menuWillShow:(NSNotification *)notification
{
    // Get the currently selected text
    UIResponder *firstResponder = [self findFirstResponder:[UIApplication sharedApplication].keyWindow];
    
    if ([firstResponder isKindOfClass:[UITextView class]]) {
        UITextView *textView = (UITextView *)firstResponder;
        NSString *selectedText = [textView textInRange:textView.selectedTextRange];
        
        if (selectedText && selectedText.length > 0) {
            // Store the selected text for later use
            [[NSUserDefaults standardUserDefaults] setObject:selectedText forKey:@"LangtoolSelectedText"];
        }
    } else if ([firstResponder isKindOfClass:[UITextField class]]) {
        UITextField *textField = (UITextField *)firstResponder;
        NSString *selectedText = [textField textInRange:textField.selectedTextRange];
        
        if (selectedText && selectedText.length > 0) {
            [[NSUserDefaults standardUserDefaults] setObject:selectedText forKey:@"LangtoolSelectedText"];
        }
    }
}

- (UIResponder *)findFirstResponder:(UIView *)view
{
    if (view.isFirstResponder) {
        return view;
    }
    
    for (UIView *subview in view.subviews) {
        UIResponder *responder = [self findFirstResponder:subview];
        if (responder) {
            return responder;
        }
    }
    
    return nil;
}

- (void)langtoolSelected:(id)sender
{
    NSString *selectedText = [[NSUserDefaults standardUserDefaults] stringForKey:@"LangtoolSelectedText"];
    
    if (selectedText) {
        [self sendEventWithName:@"onTextSelected" body:@{@"text": selectedText}];
        
        // Clean up
        [[NSUserDefaults standardUserDefaults] removeObjectForKey:@"LangtoolSelectedText"];
    }
}

- (BOOL)canPerformAction:(SEL)action withSender:(id)sender
{
    if (action == @selector(langtoolSelected:)) {
        return YES;
    }
    return NO;
}

- (void)dealloc
{
    [[NSNotificationCenter defaultCenter] removeObserver:self];
}

@end