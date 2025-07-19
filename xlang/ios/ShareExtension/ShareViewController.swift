import UIKit
import Social
import UniformTypeIdentifiers
import Foundation

class ShareViewController: UIViewController {
    
    private var scrollView: UIScrollView!
    private var contentView: UIView!
    private var stackView: UIStackView!
    private var doneButton: UIButton!
    
    private let twitterBearerToken = "AAAAAAAAAAAAAAAAAAAAABST3AEAAAAAlXMuCIEOp7Rt4P3KwVDaClFzh6A%3Dnf5fgalcIalCJuBDkcXPnAexXr03dFlQRR7PnAR5yhtmQQvXuO"
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        setupUI()
        processSharedContent()
    }
    
    private func setupUI() {
        view.backgroundColor = .systemBackground
        
        // Create scroll view for content
        scrollView = UIScrollView()
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)
        
        contentView = UIView()
        contentView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(contentView)
        
        // Create stack view for content
        stackView = UIStackView()
        stackView.axis = .vertical
        stackView.spacing = 16
        stackView.alignment = .fill
        stackView.translatesAutoresizingMaskIntoConstraints = false
        contentView.addSubview(stackView)
        
        // Create Done button
        doneButton = UIButton(type: .system)
        doneButton.setTitle("Done", for: .normal)
        doneButton.backgroundColor = .systemBlue
        doneButton.setTitleColor(.white, for: .normal)
        doneButton.layer.cornerRadius = 8
        doneButton.titleLabel?.font = UIFont.systemFont(ofSize: 17, weight: .semibold)
        doneButton.addTarget(self, action: #selector(doneButtonTapped), for: .touchUpInside)
        doneButton.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(doneButton)
        
        // Add header
        let headerLabel = UILabel()
        headerLabel.text = "Shared Content"
        headerLabel.font = UIFont.systemFont(ofSize: 24, weight: .bold)
        headerLabel.textAlignment = .center
        stackView.addArrangedSubview(headerLabel)
        
        // Add loading label initially
        let loadingLabel = UILabel()
        loadingLabel.text = "Loading shared content..."
        loadingLabel.textAlignment = .center
        loadingLabel.font = UIFont.systemFont(ofSize: 16)
        loadingLabel.textColor = .secondaryLabel
        stackView.addArrangedSubview(loadingLabel)
        
        // Set up constraints
        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            scrollView.bottomAnchor.constraint(equalTo: doneButton.topAnchor, constant: -20),
            
            contentView.topAnchor.constraint(equalTo: scrollView.topAnchor),
            contentView.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            contentView.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor),
            contentView.bottomAnchor.constraint(equalTo: scrollView.bottomAnchor),
            contentView.widthAnchor.constraint(equalTo: scrollView.widthAnchor),
            
            stackView.topAnchor.constraint(equalTo: contentView.topAnchor),
            stackView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            stackView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            stackView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
            
            doneButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            doneButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            doneButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -20),
            doneButton.heightAnchor.constraint(equalToConstant: 50)
        ])
    }
    
    @objc private func doneButtonTapped() {
        completeRequest()
    }
    
    private func processSharedContent() {
        NSLog("🔥 SHARE EXTENSION: Processing shared content")
        
        guard let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem else {
            NSLog("🔥 SHARE EXTENSION: No extension item found")
            completeRequest()
            return
        }
        
        NSLog("🔥 SHARE EXTENSION: Found extension item with \(extensionItem.attachments?.count ?? 0) attachments")
        handleSharedContent(extensionItem: extensionItem)
    }
    
    private func extractTweetId(from url: String) -> String? {
        // Handle various X.com URL formats:
        // https://x.com/username/status/1234567890
        // https://twitter.com/username/status/1234567890
        let pattern = #"(?:x\.com|twitter\.com)/[^/]+/status/(\d+)"#
        
        if let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) {
            let range = NSRange(location: 0, length: url.utf16.count)
            if let match = regex.firstMatch(in: url, options: [], range: range) {
                if let tweetIdRange = Range(match.range(at: 1), in: url) {
                    return String(url[tweetIdRange])
                }
            }
        }
        return nil
    }
    
    private func fetchTweetContent(tweetId: String) {
        let urlString = "https://api.x.com/2/tweets/\(tweetId)?tweet.fields=created_at,author_id,text,public_metrics&expansions=author_id&user.fields=name,username,profile_image_url"
        
        guard let url = URL(string: urlString) else {
            addContentItem(label: "Error", value: "Invalid Twitter API URL", type: .error)
            return
        }
        
        var request = URLRequest(url: url)
        request.setValue("Bearer \(twitterBearerToken)", forHTTPHeaderField: "Authorization")
        request.httpMethod = "GET"
        
        addContentItem(label: "Status", value: "Fetching tweet content...", type: .text)
        
        let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                self?.handleTwitterAPIResponse(data: data, response: response, error: error)
            }
        }
        
        task.resume()
    }
    
    private func handleTwitterAPIResponse(data: Data?, response: URLResponse?, error: Error?) {
        // Remove the "fetching" status message
        if let statusView = stackView.arrangedSubviews.first(where: { view in
            if let containerView = view as? UIView,
               let labelView = containerView.subviews.first(where: { $0 is UILabel }) as? UILabel {
                return labelView.text == "Status"
            }
            return false
        }) {
            statusView.removeFromSuperview()
        }
        
        if let error = error {
            addContentItem(label: "Network Error", value: error.localizedDescription, type: .error)
            return
        }
        
        guard let data = data else {
            addContentItem(label: "Error", value: "No data received from Twitter API", type: .error)
            return
        }
        
        if let httpResponse = response as? HTTPURLResponse {
            NSLog("🔥 SHARE EXTENSION: Twitter API response status: \(httpResponse.statusCode)")
            
            if httpResponse.statusCode != 200 {
                if let errorString = String(data: data, encoding: .utf8) {
                    addContentItem(label: "API Error", value: "Status \(httpResponse.statusCode): \(errorString)", type: .error)
                } else {
                    addContentItem(label: "API Error", value: "HTTP Status: \(httpResponse.statusCode)", type: .error)
                }
                return
            }
        }
        
        do {
            if let json = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] {
                parseTweetData(json: json)
            } else {
                addContentItem(label: "Parse Error", value: "Invalid JSON response", type: .error)
            }
        } catch {
            addContentItem(label: "Parse Error", value: error.localizedDescription, type: .error)
        }
    }
    
    private func parseTweetData(json: [String: Any]) {
        guard let data = json["data"] as? [String: Any] else {
            addContentItem(label: "Error", value: "No tweet data found", type: .error)
            return
        }
        
        // Extract tweet content
        let tweetText = data["text"] as? String ?? "No text available"
        let tweetId = data["id"] as? String ?? "Unknown ID"
        let createdAt = data["created_at"] as? String ?? "Unknown date"
        let authorId = data["author_id"] as? String ?? "Unknown author"
        
        // Extract author information if available
        var authorName = "Unknown User"
        var authorUsername = "unknown"
        
        if let includes = json["includes"] as? [String: Any],
           let users = includes["users"] as? [[String: Any]],
           let author = users.first(where: { ($0["id"] as? String) == authorId }) {
            authorName = author["name"] as? String ?? "Unknown User"
            authorUsername = author["username"] as? String ?? "unknown"
        }
        
        // Extract metrics if available
        var metricsText = "No metrics available"
        if let publicMetrics = data["public_metrics"] as? [String: Any] {
            let likes = publicMetrics["like_count"] as? Int ?? 0
            let retweets = publicMetrics["retweet_count"] as? Int ?? 0
            let replies = publicMetrics["reply_count"] as? Int ?? 0
            metricsText = "👍 \(likes) | 🔄 \(retweets) | 💬 \(replies)"
        }
        
        // Display tweet information
        addContentItem(label: "Author", value: "\(authorName) (@\(authorUsername))", type: .text)
        addContentItem(label: "Tweet", value: tweetText, type: .text)
        addContentItem(label: "Created", value: formatTwitterDate(createdAt), type: .text)
        addContentItem(label: "Engagement", value: metricsText, type: .text)
        addContentItem(label: "Tweet ID", value: tweetId, type: .text)
        
        NSLog("🔥 SHARE EXTENSION: Successfully parsed tweet from @\(authorUsername): \(tweetText)")
    }
    
    private func formatTwitterDate(_ dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        if let date = formatter.date(from: dateString) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateStyle = .medium
            displayFormatter.timeStyle = .short
            return displayFormatter.string(from: date)
        }
        return dateString
    }

    private func handleSharedContent(extensionItem: NSExtensionItem) {
        // Clear the loading content
        stackView.arrangedSubviews.forEach { view in
            if view != stackView.arrangedSubviews.first { // Keep the header
                view.removeFromSuperview()
            }
        }
        
        var processedItems: [String: Any] = [:]
        let group = DispatchGroup()
        
        // Extract title or subject if available
        if let title = extensionItem.attributedTitle?.string, !title.isEmpty {
            processedItems["title"] = title
            addContentItem(label: "Title", value: title, type: .text)
        }
        if let content = extensionItem.attributedContentText?.string, !content.isEmpty {
            processedItems["content"] = content
            addContentItem(label: "Content", value: content, type: .text)
        }
        
        if let attachments = extensionItem.attachments {
            for (index, attachment) in attachments.enumerated() {
                group.enter()
                
                if attachment.hasItemConformingToTypeIdentifier(UTType.text.identifier) {
                    attachment.loadItem(forTypeIdentifier: UTType.text.identifier, options: nil) { (item, error) in
                        DispatchQueue.main.async {
                            if let error = error {
                                self.addContentItem(label: "Text Error", value: error.localizedDescription, type: .error)
                            } else if let text = item as? String {
                                processedItems["text"] = text
                                self.addContentItem(label: "Text", value: text, type: .text)
                                
                                // Check if text contains a Twitter/X URL and fetch tweet content
                                if let tweetId = self.extractTweetId(from: text) {
                                    NSLog("🔥 SHARE EXTENSION: Detected Twitter URL in text with ID: \(tweetId)")
                                    self.fetchTweetContent(tweetId: tweetId)
                                }
                            }
                        }
                        group.leave()
                    }
                } else if attachment.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    attachment.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { (item, error) in
                        DispatchQueue.main.async {
                            if let error = error {
                                self.addContentItem(label: "URL Error", value: error.localizedDescription, type: .error)
                            } else if let url = item as? URL {
                                let urlString = url.absoluteString
                                processedItems["url"] = urlString
                                self.addContentItem(label: "URL", value: urlString, type: .url)
                                
                                // Check if this is a Twitter/X URL and fetch tweet content
                                if let tweetId = self.extractTweetId(from: urlString) {
                                    NSLog("🔥 SHARE EXTENSION: Detected Twitter URL with ID: \(tweetId)")
                                    self.fetchTweetContent(tweetId: tweetId)
                                }
                            }
                        }
                        group.leave()
                    }
                } else if attachment.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
                    attachment.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil) { (item, error) in
                        DispatchQueue.main.async {
                            if let error = error {
                                self.addContentItem(label: "Image Error", value: error.localizedDescription, type: .error)
                            } else if let image = item as? UIImage {
                                processedItems["image"] = "Image: \(image.size.width)x\(image.size.height)"
                                self.addContentItem(label: "Image", value: "Size: \(Int(image.size.width)) × \(Int(image.size.height))", type: .text)
                                self.addImageView(image: image)
                            }
                        }
                        group.leave()
                    }
                } else {
                    group.leave()
                }
            }
        }
        
        // Add timestamp
        let timestamp = DateFormatter()
        timestamp.dateStyle = .medium
        timestamp.timeStyle = .medium
        addContentItem(label: "Shared at", value: timestamp.string(from: Date()), type: .text)
        
        if processedItems.isEmpty {
            addContentItem(label: "No Content", value: "No shareable content was found", type: .error)
        }
    }
    
    private func addContentItem(label: String, value: String, type: ContentType) {
        let containerView = UIView()
        containerView.backgroundColor = type == .error ? .systemRed.withAlphaComponent(0.1) : .secondarySystemBackground
        containerView.layer.cornerRadius = 8
        containerView.translatesAutoresizingMaskIntoConstraints = false
        
        let labelView = UILabel()
        labelView.text = label
        labelView.font = UIFont.systemFont(ofSize: 16, weight: .semibold)
        labelView.textColor = type == .error ? .systemRed : .label
        labelView.translatesAutoresizingMaskIntoConstraints = false
        
        let valueView = UILabel()
        valueView.text = value
        valueView.font = UIFont.systemFont(ofSize: 15)
        valueView.textColor = type == .url ? .systemBlue : .secondaryLabel
        valueView.numberOfLines = 0
        valueView.translatesAutoresizingMaskIntoConstraints = false
        
        containerView.addSubview(labelView)
        containerView.addSubview(valueView)
        
        NSLayoutConstraint.activate([
            labelView.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 12),
            labelView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 16),
            labelView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -16),
            
            valueView.topAnchor.constraint(equalTo: labelView.bottomAnchor, constant: 4),
            valueView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 16),
            valueView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -16),
            valueView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor, constant: -12)
        ])
        
        stackView.addArrangedSubview(containerView)
    }
    
    private func addImageView(image: UIImage) {
        let imageView = UIImageView(image: image)
        imageView.contentMode = .scaleAspectFit
        imageView.layer.cornerRadius = 8
        imageView.clipsToBounds = true
        imageView.translatesAutoresizingMaskIntoConstraints = false
        
        let containerView = UIView()
        containerView.addSubview(imageView)
        
        NSLayoutConstraint.activate([
            imageView.topAnchor.constraint(equalTo: containerView.topAnchor),
            imageView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            imageView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
            imageView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor),
            imageView.heightAnchor.constraint(lessThanOrEqualToConstant: 200)
        ])
        
        stackView.addArrangedSubview(containerView)
    }
    
    enum ContentType {
        case text, url, error
    }
    
    private func completeRequest() {
        NSLog("🔥 SHARE EXTENSION: Completing request")
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }
}