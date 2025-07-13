//
//  ActionViewController.m
//  LangtoolExtension
//
//  Created by George Balch on 7/12/25.
//

#import "ActionViewController.h"
#import <MobileCoreServices/MobileCoreServices.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

@interface ActionViewController ()

@property(strong,nonatomic) IBOutlet UILabel *selectedTextLabel;

@end

@implementation ActionViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    
    // Set up the UI
    self.view.backgroundColor = [UIColor systemBackgroundColor];
    
    // Create and configure the label
    self.selectedTextLabel = [[UILabel alloc] init];
    self.selectedTextLabel.numberOfLines = 0;
    self.selectedTextLabel.textAlignment = NSTextAlignmentCenter;
    self.selectedTextLabel.font = [UIFont systemFontOfSize:16];
    self.selectedTextLabel.text = @"Processing selected text with Langtool...";
    self.selectedTextLabel.translatesAutoresizingMaskIntoConstraints = NO;
    
    [self.view addSubview:self.selectedTextLabel];
    
    // Add constraints
    [NSLayoutConstraint activateConstraints:@[
        [self.selectedTextLabel.centerXAnchor constraintEqualToAnchor:self.view.centerXAnchor],
        [self.selectedTextLabel.centerYAnchor constraintEqualToAnchor:self.view.centerYAnchor],
        [self.selectedTextLabel.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:20],
        [self.selectedTextLabel.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor constant:-20]
    ]];
    
    // Create Done button
    UIBarButtonItem *doneButton = [[UIBarButtonItem alloc] initWithBarButtonSystemItem:UIBarButtonSystemItemDone target:self action:@selector(done)];
    self.navigationItem.rightBarButtonItem = doneButton;
    
    // Process the selected text
    [self processSelectedText];
}

- (void)processSelectedText {
    // Get the selected text from the extension context
    NSExtensionContext *context = self.extensionContext;
    
    for (NSExtensionItem *item in context.inputItems) {
        for (NSItemProvider *itemProvider in item.attachments) {
            if ([itemProvider hasItemConformingToTypeIdentifier:UTTypePlainText.identifier]) {
                [itemProvider loadItemForTypeIdentifier:UTTypePlainText.identifier
                                                options:nil
                                      completionHandler:^(NSString *text, NSError *error) {
                    dispatch_async(dispatch_get_main_queue(), ^{
                        if (text) {
                            self.selectedTextLabel.text = [NSString stringWithFormat:@"Langtool selected:\n\n\"%@\"", text];
                            
                            // Log to console (will appear in device logs)
                            NSLog(@"Langtool Extension - Selected text: %@", text);
                            
                            // Auto-dismiss after 2 seconds
                            dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(2.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
                                [self done];
                            });
                        } else {
                            self.selectedTextLabel.text = @"No text selected";
                            dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.0 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
                                [self done];
                            });
                        }
                    });
                }];
                break;
            }
        }
    }
}

- (IBAction)done {
    // Return any edited content to the host app
    [self.extensionContext completeRequestReturningItems:self.extensionContext.inputItems completionHandler:nil];
}

@end
