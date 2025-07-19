import Foundation
import React

@objc(SharedDataModule)
class SharedDataModule: NSObject {
    
    @objc static func requiresMainQueueSetup() -> Bool {
        return false
    }
    
    @objc func getSharedData(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        let userDefaults = UserDefaults(suiteName: "group.com.langlab.shared")
        
        if let sharedData = userDefaults?.object(forKey: "SharedData") as? [String: Any],
           let timestamp = userDefaults?.object(forKey: "SharedDataTimestamp") as? Date {
            
            let result: [String: Any] = [
                "data": sharedData,
                "timestamp": timestamp.timeIntervalSince1970 * 1000
            ]
            
            userDefaults?.removeObject(forKey: "SharedData")
            userDefaults?.removeObject(forKey: "SharedDataTimestamp")
            userDefaults?.synchronize()
            
            print("SharedDataModule: Retrieved shared data: \(sharedData)")
            resolve(result)
        } else {
            resolve(nil)
        }
    }
    
    @objc func hasSharedData(
        _ resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) {
        let groupName = "group.com.langlab.shared"
        print("SharedDataModule: Checking App Group: \(groupName)")
        
        let userDefaults = UserDefaults(suiteName: groupName)
        print("SharedDataModule: UserDefaults created: \(userDefaults != nil)")
        
        let hasData = userDefaults?.object(forKey: "SharedData") != nil
        print("SharedDataModule: Has data: \(hasData)")
        
        resolve(hasData)
    }
}